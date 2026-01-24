# `action-releases-context`

This action retrieves details of a specified repository's recent releases (by tag sorted using semantic versioning) and prepares their details for use within an LLM's input context. Draft and prerelease releases are excluded. Releases with tag names that cannot be parsed by [semver](https://www.npmjs.com/package/semver) are also excluded.

> [!CAUTION]
> This action is provided for my own use and published in case it is useful to others. If you rely on it, fork and maintain your own copy. No support or stability guarantees are offered.

## Prerequisites

Before using this workflow, ensure:
- The workflow has `contents: read` permission (either via the default `GITHUB_TOKEN` or a fine-grained token).

## Inputs

Various inputs are defined in the action to configure its operation:

| Name | Description | Default
| --- | --- | ---
| `repository` | The repository to check in the format `'owner/repo'` | `${{ github.repository }}`
| `min_releases` | The minimum number of releases to include | `1`
| `max_releases` | The maximum number of releases to include; 0 for no limit | `5`
| `max_age_days` | The maximum age in days (measured from the publication date) of release to include; 0 for no limit | `365`
| `max_tokens` | The maximum number of tokens to use (approximated by character count) | `500`
| `strip_images` | Remove any images (HTML or Markdown format) from the release bodies | `true`
| `strip_links` | Remove any links (HTML or Markdown format) from the release bodies | `true`
| `strip_html` | Remove all HTML tags from the release bodies | `false`
| `strip_regexps` | Regular expressions (one per line) applied to the release bodies for additional content that should be removed | `''`
| `github_token` | The GitHub token used to create an authenticated client | `${{ github.token }}`

The `min_releases` constraint (if non-zero) takes priority over all of the max constraints. This ensures that some releases are found, even if old or with large bodies. Release bodies are not truncated, even if that results in the `max_tokens` constraint being exceeded.

Releases are first sorted in descending semantic version order. The `max_age_days` limit is then used to find the oldest acceptable release in that version-ordered list. All newer versions above that point are included, even if some of them were published earlier than the age limit. This ensures that version history is not broken purely due to publication dates.

## Outputs

The action provides the following outputs:

| Name | Description
| --- | ---
| `releases` | JSON array of releases prepared for LLM input context, in descending tag version order

## Usage

Example workflow to generate an AI summary of recent releases for Homebridge:

```yaml
name: Recent Releases
permissions:
  contents: read

on:
  workflow_dispatch:
  schedule:
    # Runs at 09:00 UTC daily
    # Stagger different repos to avoid hitting GitHub API rate limits
    - cron: '0 9 * * *'

env:
  REPO: homebridge/homebridge

jobs:
  recent-releases:
    runs-on: ubuntu-latest

    steps:
      - name: Retrieve details of recent releases
        id: context
        uses: thoukydides/action-releases-context@v1
        with:
          repository: ${{ env.REPO }}
          strip_regexps: |
            /^\s*- `chore:.*\n/m
    
      - name: Generate an AI summary
        uses: actions/ai-inference@v1
        with:
          prompt: |
            Generate a Markdown summary of the Homebridge releases listed below.
            For each release provide a 1-2 sentence description, highlighting user-visible changes.

            ${{ steps.context.outputs.releases }}
```

> [!TIP]
> The `strip_regexps` are applied sequentially in the order provided, so an earlier pattern may affect whether a later one matches. The `g` flag is always added.

## ISC License (ISC)

<details>
<summary>Copyright © 2026 Alexander Thoukydides</summary>

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
</details>