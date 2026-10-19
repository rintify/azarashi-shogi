using System.Linq;

namespace Azarashi.UnityView
{
    /// <summary>The original UI's offer/confirmation policy, after Rust supplies legal previews.</summary>
    public static class NativeChoices
    {
        public static Preview[] Offered(PieceState selected, Preview[] moves)
        {
            var preferred = selected?.kind == "seal" && !selected.promoted && moves.Any(p => p.piece.promoted) ? moves.Where(p => p.piece.promoted).ToArray() : moves;
            return preferred.Length > 0 && preferred[0].captured.Any(p => p.kind == "walrus") ? preferred.Take(1).ToArray() : preferred;
        }
        public static bool RequiresChoice(Preview[] options, string human) => options.Length > 1 || options.Length > 0 && options[0].captured.Any(p => p.kind == "walrus" && p.owner == human);
    }
}
