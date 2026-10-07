---
title: Nodd community models
emoji: 👋
colorFrom: blue
colorTo: gray
sdk: static
app_file: index.html
pinned: false
license: mit
short_description: Find and share small, open-source Nodd models
---

# Nodd community models

A searchable catalog of small, open-source models you can download, reuse, and adapt.
Models stay in their authors' Hugging Face repositories. This Space hosts the catalog.

## Add your model

You don't need to join the Nodd organization to propose a listing.

1. Publish your nodd-compatible model in a **public Hugging Face model repository**.
   Include its ONNX export, tokenizer files, `nodd.json`, an open-source license,
   a model card explaining its task and labels, and evaluation results and limitations.
2. In this Space's **Files** tab, open `models.json` and choose **Edit**.
3. Add one entry to the array, using the example below. Keep all existing entries.
4. Choose **Open as a pull request** and explain what the model does. Include a link
   to its evaluation results in the pull request description.
5. A maintainer reviews the submission. Once merged, it appears in the catalog.

```json
{
  "repo_id": "your-name/your-model",
  "name": "Your model name",
  "tags": ["sentiment", "text-classification"],
  "description": "A brief description of the decision this model makes.",
  "size_mb": 24.3,
  "license": "apache-2.0",
  "revision": "v1"
}
```

`size_mb` is the browser download size in decimal MB, including the quantized model
and tokenizer. Use `null` if you haven't measured it. Use a license identifier that
matches your model card. `revision` is optional; specify a published tag or commit
for a reproducible listing. Each `repo_id` may appear only once; update the existing
entry when publishing a new version. Keep descriptions under 300 characters.

The supported fields are `repo_id`, `name`, `tags`, `description`, `size_mb`, `license`,
and optional `revision`. Supply one or more unique tags using lowercase letters,
numbers, and hyphens (for example, `sentiment` and `text-classification`). A model
can have multiple tags. The Tags filter matches **all** selected tags; text search
also searches every tag. The author is derived from the repository owner. The table
searches names, tags, descriptions, authors, repository IDs, and licenses.

If editing JSON is unfamiliar, open a thread in the **Community** tab with your
model link, tags, license, download size, and evaluation results. A maintainer can
help prepare the listing. A discussion alone does not publish a listing.

## Review

Check that the model is public, the stated license permits reuse, its Nodd export
loads, and the model card explains its evaluation data and limitations. Listing a
model is not a guarantee of accuracy. Scores from different tasks or datasets are
not directly comparable, so this catalog is not a leaderboard.

Before merging a listing, run `node --test catalog.test.mjs` to validate the complete
catalog and search/sort behavior. This is a maintainer check, not an automatic gate.

## Development

Plain HTML, CSS, and JavaScript; no build step, backend, or API token required.
From a checkout of the Nodd source repository:

```sh
python3 -m http.server 8080 --directory community
node --test community/catalog.test.mjs
```

In a clone of the Space itself, run `python3 -m http.server 8080` from its root.

Source lives in [quaedra/nodd](https://github.com/quaedra/nodd/tree/main/community).
**The live Space's `models.json` is authoritative for community submissions.** Before
publishing app updates from GitHub, retrieve the latest catalog from this Space and
preserve accepted submissions. Do not overwrite it with an older source snapshot.
