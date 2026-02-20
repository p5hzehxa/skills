#!/usr/bin/env bun

/**
 * Sync marketplace.json from individual plugin.json files.
 * Run after bumping versions in any plugin.json file.
 *
 * Usage: bun run scripts/sync-marketplace.ts
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, resolve } from "path";

const projectRoot = resolve(import.meta.dir, "..");
const skillsDir = resolve(projectRoot, "skills");
const marketplacePath = resolve(projectRoot, ".claude-plugin/marketplace.json");

function discoverPlugins() {
  const plugins: Record<string, unknown>[] = [];

  for (const entry of readdirSync(skillsDir)) {
    const pluginJsonPath = join(skillsDir, entry, ".claude-plugin/plugin.json");
    const pluginDir = join(skillsDir, entry);

    if (!statSync(pluginDir).isDirectory()) continue;

    try {
      statSync(pluginJsonPath);
    } catch {
      continue; // no plugin.json — not a standalone plugin
    }

    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));

    const plugin: Record<string, unknown> = {
      name: pluginJson.name,
      description: pluginJson.description,
      version: pluginJson.version,
      author: pluginJson.author,
      source: `./skills/${entry}`,
    };

    if (pluginJson.homepage) plugin.homepage = pluginJson.homepage;
    if (pluginJson.repository) plugin.repository = pluginJson.repository;
    if (pluginJson.license) plugin.license = pluginJson.license;
    if (pluginJson.category) plugin.category = pluginJson.category;
    if (pluginJson.keywords) plugin.keywords = pluginJson.keywords;

    plugins.push(plugin);
    console.log(`  ${pluginJson.name} (${pluginJson.version})`);
  }

  return plugins;
}

function sync() {
  const marketplace = JSON.parse(readFileSync(marketplacePath, "utf-8"));

  console.log("Discovering plugins...");
  marketplace.plugins = discoverPlugins();

  writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");
  console.log(`\n✓ Marketplace synced: ${marketplace.plugins.length} plugins`);
}

sync();
