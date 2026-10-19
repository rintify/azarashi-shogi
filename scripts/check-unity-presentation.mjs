import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(
  await readFile(
    new URL('../unity/Assets/Resources/Native/PresentationSources.json', import.meta.url),
    'utf8',
  ),
);
for (const source of manifest.sources) {
  const sourceText = await readFile(new URL('../' + source.path, import.meta.url), 'utf8');
  if (
    createHash('sha256').update(sourceText.replaceAll('\r\n', '\n')).digest('hex') !== source.sha256
  )
    throw new Error(
      `Original presentation changed: ${source.path}. Recapture the source lighting/audio through the development asset-export screen before building Unity.`,
    );
}
