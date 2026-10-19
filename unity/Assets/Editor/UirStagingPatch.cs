using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Serialization;
using UnityEditor;
using UnityEngine;

namespace Azarashi.UnityView.Editor
{
    /// <summary>
    /// UUM-151098: size staging storage after consolidation, including index
    /// alignment headroom. Rewrites only a project-private WebGL player module.
    /// Uses the editor's bundled Cecil; no installation or runtime hooks.
    /// </summary>
    public static class UirStagingPatch
    {
        private static Type instructionType, opCodesType;
        private static IEnumerable<dynamic> Items(object sequence) => ((IEnumerable)sequence).Cast<dynamic>();
        private static object Instruction(string opcode, object operand = null)
        {
            var code = opCodesType.GetField(opcode).GetValue(null);
            var args = operand == null ? new[] { code } : new[] { code, operand };
            var create = instructionType.GetMethods().Single(m => m.Name == "Create" && m.GetParameters().Length == args.Length &&
                m.GetParameters().Select((p, i) => p.ParameterType.IsInstanceOfType(args[i])).All(x => x));
            return create.Invoke(null, args);
        }
        public static void Prepare()
        {
            if (Application.unityVersion != "6000.5.8f1")
                throw new Exception("Review the UIR patch for this Unity version.");
            ValidateBounds();
            var path = Path.GetFullPath(Environment.GetEnvironmentVariable("AZARASHI_PLAYER_MODULE_COPY") ?? "");
            var tooling = Path.GetFullPath(Path.Combine(Application.dataPath, "../../.openai/tooling")) + Path.DirectorySeparatorChar;
            if (!path.StartsWith(tooling, StringComparison.OrdinalIgnoreCase) || Path.GetFileName(path) != "UnityEngine.UIElementsModule.dll")
                throw new Exception("UIR patch target must be the project-private player module.");
            var cecil = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetType("Mono.Cecil.AssemblyDefinition") != null)
                ?? Assembly.LoadFrom(Path.Combine(EditorApplication.applicationContentsPath, "Managed/Unity.Cecil.dll"));
            instructionType = cecil.GetType("Mono.Cecil.Cil.Instruction");
            opCodesType = cecil.GetType("Mono.Cecil.Cil.OpCodes");
            var parametersType = cecil.GetType("Mono.Cecil.ReaderParameters");
            dynamic parameters = Activator.CreateInstance(parametersType);
            parameters.InMemory = true;
            dynamic resolver = Activator.CreateInstance(cecil.GetType("Mono.Cecil.DefaultAssemblyResolver"));
            resolver.AddSearchDirectory(Path.GetDirectoryName(path));
            resolver.AddSearchDirectory(Path.Combine(EditorApplication.applicationContentsPath, "Managed/UnityEngine"));
            parameters.AssemblyResolver = resolver;
            var reader = cecil.GetType("Mono.Cecil.AssemblyDefinition").GetMethod("ReadAssembly", new[] { typeof(string), parametersType });
            dynamic assembly = reader.Invoke(null, new object[] { path, parameters });
            try
            {
                dynamic type = Items((object)assembly.MainModule.Types).Single(t => (string)t.FullName == "UnityEngine.UIElements.UIR.GpuUpdaterStaged`1");
                dynamic complete = Items((object)type.Methods).Single(m => (string)m.Name == "CompleteUpdate");
                dynamic prepare = Items((object)type.Methods).Single(m => (string)m.Name == "PrepareCopyRanges");
                var body = Items((object)complete.Body.Instructions).ToList();
                var prep = Items((object)prepare.Body.Instructions).ToList();
                dynamic allocation = body.Single(i => i.Operand != null && (string)i.OpCode.Name == "call" && (string)i.Operand.Name == "FindOrAllocateBuffer");
                dynamic dirty = body.Single(i => i.Operand != null && ((string)i.OpCode.Name == "call" || (string)i.OpCode.Name == "callvirt") && (string)i.Operand.Name == "get_totalDirtyCount");
                dynamic consolidation = prep.Single(i => i.Operand != null && ((string)i.OpCode.Name == "call" || (string)i.OpCode.Name == "callvirt") && (string)i.Operand.Name == "ConsolidateRanges");
                dynamic ranges = prep.First(i => i.Operand != null && (string)i.OpCode.Name == "ldfld" && (string)i.Operand.Name == "dirtyRanges");
                dynamic count = prep.First(i => i.Operand != null && ((string)i.OpCode.Name == "call" || (string)i.OpCode.Name == "callvirt") && (string)i.Operand.Name == "get_Count");
                dynamic dataSet = Items((object)complete.Body.Variables).Single(v => ((string)v.VariableType.FullName).StartsWith("UnityEngine.UIElements.UIR.DataSet`1<"));
                if (body.IndexOf(dirty) >= body.IndexOf(allocation) || body.Any(i => i.Operand != null &&
                    ((string)i.OpCode.Name == "call" || (string)i.OpCode.Name == "callvirt") && (string)i.Operand.Name == "ConsolidateRanges"))
                    throw new Exception("Unexpected staging IL; refusing an unreviewed patch.");
                dynamic il = complete.Body.GetILProcessor();
                // Stack already contains [this, availableBuffers, dataSet].
                il.InsertBefore(dirty, (dynamic)Instruction("Dup"));
                il.InsertBefore(dirty, (dynamic)Instruction("Ldc_R4", .9f));
                il.InsertBefore(dirty, (dynamic)Instruction("Call", (object)consolidation.Operand));
                // Every remaining index range can grow by at most two indices.
                // Reserve this small allowance for either specialization.
                dynamic cursor = dirty;
                foreach (var item in new[] {
                    Instruction("Ldloc", (object)dataSet), Instruction("Ldfld", (object)ranges.Operand),
                    Instruction("Callvirt", (object)count.Operand), Instruction("Ldc_I4_2"),
                    Instruction("Mul"), Instruction("Add") })
                {
                    il.InsertAfter(cursor, (dynamic)item);
                    cursor = item;
                }
                // Inserted IL may lengthen branch distances beyond a short jump.
                foreach (dynamic item in Items((object)complete.Body.Instructions))
                {
                    var name = (string)item.OpCode.Name;
                    if (!name.EndsWith(".s") || item.Operand == null || !instructionType.IsInstanceOfType((object)item.Operand)) continue;
                    var field = string.Join("_", name.Substring(0, name.Length - 2).Split('.').Select(part => char.ToUpperInvariant(part[0]) + part.Substring(1)));
                    var replacement = opCodesType.GetField(field) ?? throw new Exception("Unknown short branch: " + name);
                    item.OpCode = (dynamic)replacement.GetValue(null);
                }
                complete.Body.MaxStackSize = Math.Max((int)complete.Body.MaxStackSize, 8);
                var temporary = path + ".patched";
                assembly.Write(temporary);
                File.Copy(temporary, path, true);
                File.Delete(temporary);
                Debug.Log("UUM-151098 correction: consolidate before allocation, plus two indices per range. Installed editor untouched.");
            }
            finally { ((IDisposable)assembly).Dispose(); ((IDisposable)resolver).Dispose(); }
        }
        public static void ValidateBounds()
        {
            if (Application.unityVersion != "6000.5.8f1") return;
            // Exercise the actual shipped consolidation function with ranges
            // crossing staging tiers and with sparse odd-aligned index ranges.
            var type = typeof(UnityEngine.UIElements.VisualElement).Assembly.GetType("UnityEngine.UIElements.UIR.DataSet`1").MakeGenericType(typeof(ushort));
            const BindingFlags flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;
            var cases = new[] {
                new[] { (0u, 4000u), (4300u, 4000u) },
                new[] { (0u, 32000u), (34000u, 33000u) },
                new[] { (0u, 130000u), (135000u, 130000u) },
                Enumerable.Range(0, 3000).Select(i => ((uint)(i * 6 + 1), 2u)).ToArray(),
                new[] { (1u, 2u), (9u, 2u), (19u, 2u) }
            };
            var oldUnderAllocations = 0;
            foreach (var ranges in cases)
            {
                var data = FormatterServices.GetUninitializedObject(type);
                GC.SuppressFinalize(data);
                var field = type.GetField("dirtyRanges", flags);
                var list = (IList)Activator.CreateInstance(field.FieldType);
                var rangeType = field.FieldType.GetGenericArguments()[0];
                uint total = 0;
                foreach (var range in ranges)
                {
                    var value = Activator.CreateInstance(rangeType);
                    rangeType.GetField("start", flags).SetValue(value, range.Item1);
                    rangeType.GetField("count", flags).SetValue(value, range.Item2);
                    list.Add(value);
                    total += range.Item2;
                }
                field.SetValue(data, list);
                type.GetField("m_TotalDirtyCount", flags).SetValue(data, total);
                type.GetField("m_DirtyRangeMin", flags).SetValue(data, ranges.Min(r => r.Item1));
                type.GetField("m_DirtyRangeMax", flags).SetValue(data, ranges.Max(r => r.Item1 + r.Item2));
                type.GetMethod("ConsolidateRanges", flags).Invoke(data, new object[] { .9f });
                var consolidated = (uint)type.GetField("m_TotalDirtyCount", flags).GetValue(data);
                uint required = 0;
                foreach (var range in list)
                {
                    var start = (uint)rangeType.GetField("start", flags).GetValue(range);
                    var count = (uint)rangeType.GetField("count", flags).GetValue(range);
                    required += ((start + count + 1) & ~1u) - (start & ~1u);
                }
                if (required > total) oldUnderAllocations++;
                if (required > consolidated + list.Count * 2u)
                    throw new Exception("UIR staging reservation does not cover consolidated/aligned source ranges.");
            }
            if (oldUnderAllocations < 4) throw new Exception("UIR boundary validation did not reproduce the original under-allocation.");
            Debug.Log("UUM-151098 boundary validation passed: five source consolidation cases, including staging tiers and odd index alignment.");
        }
    }
}
