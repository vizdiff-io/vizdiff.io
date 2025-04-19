# @vizdiff/cli

[![npm version](https://img.shields.io/npm/v/@vizdiff/cli.svg)](https://www.npmjs.com/package/@vizdiff/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

The official command-line interface for [VizDiff.io](https://vizdiff.io), the visual regression testing platform designed for modern component libraries.

This CLI tool allows you to easily upload your [Storybook](https://storybook.js.org/) builds to VizDiff for visual testing, comparison, and approval workflows integrated directly with your Git workflow and GitHub Pull Requests.

## Features

- **Simple Upload:** Upload your static Storybook build directory with a single command.
- **Git Integration:** Automatically detects the current Git commit SHA, branch name, and base commit/branch for comparison.
- **Flexible Configuration:** Override detected Git information and API endpoint via command-line flags or environment variables.
- **CI/CD Ready:** Designed for easy integration into your continuous integration pipelines.

## Installation

Install the CLI globally using npm:

```bash
npm install -g @vizdiff/cli
```

Or install it as a dev dependency in your project:

```bash
npm install --save-dev @vizdiff/cli
# or
yarn add --dev @vizdiff/cli
```

## Usage

The primary command is `vizdiff upload`:

```bash
vizdiff upload <path-to-storybook-build-dir> [options]
```

**Example:**

```bash
vizdiff upload storybook-static
```

### Authentication

You need a VizDiff **Project Token** to upload builds.

1.  Find your Project Token in your VizDiff project: [https://vizdiff.io/projects](https://vizdiff.io/settings/projects) (You'll need to sign up for VizDiff if you haven't already).
2.  Provide the token using either:
    - The `VIZDIFF_PROJECT_TOKEN` environment variable (recommended, especially for CI):
      ```bash
      export VIZDIFF_PROJECT_TOKEN="your_project_token_here"
      vizdiff upload storybook-static
      ```
    - The `--token` or `-t` command-line flag:
      ```bash
      vizdiff upload storybook-static --token="your_project_token_here"
      ```

### Options

| Option                  | Alias | Environment Variable    | Description                                                                                               | Default                     |
| ----------------------- | ----- | ----------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------- |
| `--token`               | `-t`  | `VIZDIFF_PROJECT_TOKEN` | **(Required)** Your VizDiff project token.                                                                | -                           |
| `--commit`              | `-c`  | -                       | Git commit SHA being built.                                                                               | Latest commit hash          |
| `--branch`              | `-b`  | -                       | Git branch name being built.                                                                              | Current branch name         |
| `--base-branch`         |       | -                       | Base branch name for comparison (e.g., `main`, `master`).                                                 | Default repo branch         |
| `--base-commit`         |       | -                       | Base commit SHA for comparison.                                                                           | Merge base with base branch |
| `--pr`                  |       | -                       | GitHub Pull Request number associated with the commit (if applicable).                                    | -                           |
| `<storybook-build-dir>` |       | -                       | **(Required)** Path to the directory containing your static Storybook build (usually `storybook-static`). | -                           |
| -                       |       | `VIZDIFF_API_URL`       | Override the VizDiff API endpoint.                                                                        | `https://vizdiff.io/api`    |

**Example with overrides:**

```bash
export VIZDIFF_PROJECT_TOKEN="your_project_token_here"
vizdiff upload storybook-static \
  --commit="abcdef1234567890" \
  --branch="feature/new-button" \
  --base-branch="main" \
  --pr=123
```

### Git Integration Details

The CLI attempts to automatically determine the correct commit SHA, branch, and base comparison details using `git` commands within your repository:

- **Commit SHA (`--commit`):** Uses the hash of the latest commit (`git log -1`).
- **Branch (`--branch`):** Uses the current branch name (`git status`).
- **Base Branch (`--base-branch`):** Uses the repository's default branch (e.g., `main` or `master`, determined by looking at `origin/HEAD`).
- **Base Commit (`--base-commit`):**
  - If the current branch **is** the base branch, it uses the previous commit (`HEAD~1`).
  - If the current branch **is not** the base branch, it uses the merge base between the current branch and the base branch (`git merge-base`).

You can override any of these automatic detections using the corresponding command-line flags if needed.

## How it Works

1.  The CLI verifies the existence of necessary Storybook build files (`project.json`, `index.json`) in the specified directory.
2.  It gathers Git metadata (commit, branch, etc.) unless overridden by flags.
3.  The Storybook build directory is compressed into a `.tar.gz` archive.
4.  The archive is uploaded to the VizDiff API endpoint (`/upload/storybook`) along with the project token and Git metadata.
5.  VizDiff processes the Storybook, renders components, performs visual diffs against the base build, and reports the results back through the VizDiff web app and any configured GitHub checks.

## Contributing

Contributions are welcome! Feel free to open an issue to start a discussion, and send a pull request with a suggested improvement.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For help and support, post an issue to this repository or visit [vizdiff.io](https://vizdiff.io) to find contact information for our support team.
