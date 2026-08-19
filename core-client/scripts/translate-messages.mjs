import {readFile, writeFile} from "node:fs/promises";

const targets = {es: "Spanish", de: "German", tr: "Turkish", it: "Italian", kk: "Kazakh"};
const source = JSON.parse(await readFile(new URL("../messages/en.json", import.meta.url), "utf8"));
const leaves = [];
const protectedPattern = /\{\w+\}|source ~\/\.\w+|bun (?:run (?:dev|build)|test)|hcode doctor|rm -rf|~\/[\w./*-]*[\w/*-]|\b(?:openrouter\/free|github\/github-mcp-server|provider\/model-name)\b|(?<![\w])\/[a-z][\w-]*|(?<![\w])--?[a-z][\w-]*|\b[\w-]+\.(?:json|ts|sh)\b|\b(?:apply_patch|openrouter\.ai|github-mcp-server)\b/g;

function walk(value, path = []) {
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") leaves.push({path: [...path, key], text: child});
    else walk(child, [...path, key]);
  }
}

async function request(text, locale, attempt = 0) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({client: "gtx", sl: "en", tl: locale, dt: "t", q: text});
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(30_000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data[0].map((part) => part[0]).join("");
  } catch (error) {
    if (attempt === 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    return request(text, locale, attempt + 1);
  }
}

function assign(root, path, value) {
  let parent = root;
  for (const key of path.slice(0, -1)) parent = parent[key];
  parent[path.at(-1)] = value;
}

walk(source);

for (const [locale, language] of Object.entries(targets)) {
  const output = structuredClone(source);
  const batches = [];
  let batch = [];
  let size = 0;

  for (const [index, leaf] of leaves.entries()) {
    let tokenIndex = 0;
    const protectedText = leaf.text.replace(
      protectedPattern,
      () => `\uE100${index}_${tokenIndex++}\uE101`,
    );
    const item = `\uE000${index}\uE001\n${protectedText}`;
    if (size + item.length > 3500 && batch.length) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push({index, item});
    size += item.length;
  }
  if (batch.length) batches.push(batch);

  console.log(`${language}: ${batches.length} batches`);
  for (const [batchIndex, items] of batches.entries()) {
    const translated = await request(items.map(({item}) => item).join("\n"), locale);
    const markers = [...translated.matchAll(/\uE000(\d+)\uE001\s*/g)];
    if (markers.length !== items.length) throw new Error(`${locale}: marker mismatch in batch ${batchIndex + 1}`);

    for (const [markerIndex, marker] of markers.entries()) {
      const index = Number(marker[1]);
      const start = marker.index + marker[0].length;
      const end = markers[markerIndex + 1]?.index ?? translated.length;
      const rawValue = translated.slice(start, end).trim();
      const expectedTokens = [...leaves[index].text.matchAll(protectedPattern)];
      const translatedTokens = [...rawValue.matchAll(/\uE100(\d+)_(\d+)\uE101/g)];
      if (
        translatedTokens.length !== expectedTokens.length ||
        translatedTokens.some((token) => Number(token[1]) !== index) ||
        translatedTokens.map((token) => Number(token[2])).sort((a, b) => a - b).some((tokenIndex, position) => tokenIndex !== position)
      ) throw new Error(`${locale}: token changed at ${leaves[index].path.join(".")}`);
      const value = rawValue.replace(
        /\uE100(\d+)_(\d+)\uE101/g,
        (_, leafIndex, restoredTokenIndex) =>
          [...leaves[Number(leafIndex)].text.matchAll(protectedPattern)][Number(restoredTokenIndex)][0],
      );
      const expectedVariables = [...leaves[index].text.matchAll(/\{\w+\}/g)].map(String).sort();
      const actualVariables = [...value.matchAll(/\{\w+\}/g)].map(String).sort();
      if (expectedVariables.join() !== actualVariables.join()) throw new Error(`${locale}: variables changed at ${leaves[index].path.join(".")}`);
      assign(output, leaves[index].path, value);
    }
    console.log(`  ${batchIndex + 1}/${batches.length}`);
  }

  await writeFile(new URL(`../messages/${locale}.json`, import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
}
