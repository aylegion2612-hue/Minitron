const fs = require("fs");
const path = require("path");

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function extractSkillsFromMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const skills = [];
  const seen = new Set();
  let category = "community";
  let insideSkills = false;

  for (const line of lines) {
    if (line.includes("<details")) {
      insideSkills = true;
    }

    const categoryMatch = line.match(/<summary><h3[^>]*>([^<]+)<\/h3><\/summary>/i);
    if (categoryMatch) {
      category = slugify(categoryMatch[1].trim());
      continue;
    }

    if (!insideSkills) {
      continue;
    }

    // Matches list items like: - [Skill Name](https://clawskills.sh/skills/owner-skill) - description
    const m = line.match(/^\s*[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*-?\s*(.*)$/);
    if (!m) continue;

    const name = m[1].trim();
    const sourceUrl = m[2].trim();
    if (!sourceUrl.includes("clawskills.sh/skills/")) {
      continue;
    }

    const urlSlugMatch = sourceUrl.match(/\/skills\/([^/?#)]+)/i);
    const slug = urlSlugMatch ? urlSlugMatch[1].toLowerCase() : slugify(name);
    if (seen.has(slug)) {
      continue;
    }
    seen.add(slug);

    const description = (m[3] || "Imported from awesome skills list.").trim();
    skills.push({
      slug,
      name,
      category,
      description,
      version: "1.0.0",
      sourceUrl,
      changelog: "Imported from awesome skills list.",
    });
  }

  return skills;
}

async function main() {
  const url =
    "https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch registry source: ${response.status}`);
  }
  const markdown = await response.text();
  const skills = extractSkillsFromMarkdown(markdown);

  const outputPath = path.resolve(process.cwd(), "core", "skills", "registry.json");
  fs.writeFileSync(outputPath, JSON.stringify({ skills }, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${skills.length} skills to ${outputPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
