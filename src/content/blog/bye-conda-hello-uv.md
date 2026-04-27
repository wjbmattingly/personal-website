---
title: "Bye Conda, Hello uv"
pubDate: 2026-04-25
author: "William Mattingly"
tags: ["uv", "environment management"]
---

Switching a Python project from Conda to [uv](https://docs.astral.sh/uv/) completely changed how I handle local and remote setups. The push came when we hired a new team member who works exclusively on Windows. That platform mismatch exposed the cracks in my old workflow and gave me the perfect excuse to test a faster, stricter alternative.

Environment management is how developers keep project dependencies isolated so an update in one project doesn't break another. For years, Conda was the absolute standard in the data science space for this task.

## Scaling up with Conda

I first learned about Conda as a postdoc at the Smithsonian's Data Science Lab. My colleague [Mike Trizna](https://datascience.si.edu/people/mike-trizna) introduced me to it when my research scaled from my local Windows machine to the Smithsonian's Linux-based High Performance Computing cluster.

Conda became my tool of choice because data science projects carry heavy machine learning dependencies. Mapping out the exact requirements for packages like [TensorFlow](https://www.tensorflow.org/) or [PyTorch](https://pytorch.org/) used to be a nightmare of conflicting C++ libraries and CUDA toolkits. Conda solved that under the hood and made installing complex packages reliable.

But Conda has significant weaknesses today. Dependency resolution is notoriously slow. If you mix channels, like defaults and conda-forge, you often end up with broken environments that compute for twenty minutes just to fail. Conda environments also tend to be bloated, eating up massive amounts of disk space. Most importantly, when you need to guarantee that a project running perfectly on Ubuntu won't throw errors on Windows, Conda struggles to provide strict cross-platform reproducibility without forcing you to jump through complex configuration hoops.

Long story short, Conda had gradually been growing on my nerves over the past year or so.

## The cross-platform reality

When I first started at Yale in 2024, I continued to use Conda. I mostly worked with one other colleague on machine learning projects and we both used Macs. When I needed to run a job on Yale's HPC cluster, I needed to migrate my codebase to Linux. Yale has a number of HPCs. I mainly use Bouchet for general projects and Hopper for projects containing personally identifiable information. For these purposes, Conda was fine. Transitioning from Mac to Linux is much easier than from Windows to Linux and Conda's limitations were noticeable but ignorable.

Recently, however, we hired a new data engineer, [Ben Norton](https://github.com/ben-norton) who uses a Windows machine. I also was assigned a project that required an AI pipeline to run in real-time on a Windows scanning machine. This meant Windows would be in my life for the foreseeable future and relying on the relatively easy compatibility between Mac and Linux would be something I could no longer take for granted.

Before on-boarding our new hire, I wanted to make sure all our immediate projects would be available to him. I dusted off my Windows machine and noticed that many projects had trouble starting. I immediately noticed that Conda environments would break. This gave me the perfect opportunity to finally test out uv because this is where uv shines.

Uv is an extremely fast Python package and project manager written in Rust. By default, it generates cross-platform lockfiles. A lockfile records the exact versions of every single dependency. You resolve your dependencies once, and uv ensures everyone on the team gets the exact same environment regardless of their operating system. Because it is built with Rust, resolving and installing those packages takes seconds rather than minutes.

Another massive benefit is that modern Large Language Models already know how to write configurations for it. Whether you use [ChatGPT](https://chatgpt.com/), [Claude](https://claude.ai/), or [Gemini](https://gemini.google.com/), you can simply tell your prompt to use uv for the project. The model will correctly generate the setup commands without you wasting prompt tokens explaining the tool.

## Getting started

Migrating a project or starting a new one is very straightforward. You install the tool, initialize a directory, and add your dependencies.

```bash
# Install uv on Mac or Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Initialize a new Python project
uv init my_project
cd my_project

# Add a machine learning dependency
uv add spacy
```

## Migrating existing projects

For most of my existing projects, migrating to uv was surprisingly frictionless. Coming from a standard `requirements.txt`, the transition is virtually instantaneous: you simply initialize the project and run `uv add -r requirements.txt`. The tool parses the list, resolves the fastest paths, and locks the dependencies.

Transitioning from Conda's `environment.yml` requires a slight translation step, as Conda sometimes relies on different package names or hosts non-Python binaries that PyPI doesn't cover. I found it easiest to pass my `environment.yml` directly to an LLM—like Opus 4.7 or Gemini—and prompt it to extract the standard Python packages to generate a `pyproject.toml` file. Once the file was generated, a simple `uv sync` command took over, resolving the cross-platform dependencies and building the environment in seconds. 

## Understanding uv's core files

When you initialize and build out a project with uv, it drops the bloated hidden directories Conda relies on and instead uses three highly transparent, standard files to keep everything deterministic.

* **`pyproject.toml`:** This is the modern, standardized configuration file for Python projects (based on PEP 621). Instead of relying on proprietary `environment.yml` formats, uv explicitly tracks your project's metadata, primary dependencies, and build system right here. It is highly readable and natively understood by modern Python tooling.
* **`uv.lock`:** This is where uv's cross-platform magic happens. Unlike standard `pip` which only resolves dependencies for the machine currently running the command, uv resolves the entire dependency tree for Windows, macOS, and Linux simultaneously. It pins the exact hashes and versions for all platforms in this lockfile. You commit `uv.lock` to your repository so that your Windows engineer and your Linux HPC build the exact same environment without conflicts.
* **`.python-version`:** A simple, single-line text file declaring the required Python version for the project (e.g., `3.12`). If a teammate clones the repository and doesn't have Python 3.12 installed, uv will automatically fetch and manage the correct Python binary for their specific operating system on the fly.

## Organizing a project around uv

Switching to uv fundamentally streamlined my day-to-day project structure. Because uv is capable of managing the Python executable itself, you rarely need to think about manually creating or activating virtual environments.

### The ideal project structure

A standard machine learning or data science project organized around uv looks incredibly clean:

```text
my_project/
├── .python-version      # Specifies the Python version
├── pyproject.toml       # High-level project config and dependencies
├── uv.lock              # Strict, cross-platform dependency pins
├── .venv/               # The isolated environment (automatically managed)
├── src/                 # Your actual Python codebase
│   └── data_pipeline.py
└── tests/               # Your test suite
```

### Executing code with `uv run`

One of the biggest paradigm shifts from Conda is how you execute scripts. Instead of typing `conda activate my_env` and hoping you don't have overlapping environment variables before running `python src/data_pipeline.py`, you simply use uv's runner:

```bash
uv run src/data_pipeline.py
```

This command acts as a strict gateway. It guarantees that the script executes inside the isolated `.venv` environment, using only the locked dependencies. If the environment doesn't exist yet (for instance, right after cloning the repo on a new Windows machine), `uv run` will automatically build the environment and then execute the script in one seamless motion.

### Managing development dependencies

In data science, you often need tools for local development—like `pytest` for testing, `ruff` for linting, or `jupyter` for exploration—that you absolutely do not want packaged into your final deployment on the HPC cluster. uv handles this natively through dependency groups.

```bash
# Add a package only for local development
uv add --dev jupyter ruff
```

This clearly separates your core machine learning libraries from your testing and exploration tools within the `pyproject.toml`. When you eventually deploy the codebase to a production server or cluster, you can run `uv sync --no-dev` to install only the absolute necessities, keeping your deployment fast, secure, and lean.

## Conclusion

Conda solved a massive problem for data scientists when we desperately needed a reliable way to install complex packages. But the Python ecosystem has evolved. If you manage environments across different operating systems or regularly deploy jobs to an HPC cluster, uv offers a faster and strictly reproducible alternative.
