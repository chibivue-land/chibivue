# Contributing to chibivue

Are you looking at this page now because you're interested in contributing to chibivue? If so, I'd be very pleased.  
I'd appreciate it if you could create some pull request, no matter how minor.  
I've written some guides below on how to contribute, so please take a moment to read them.
Thank you to all chibivue fans. 💖

ubugeeei.

---

## Guide to the main directories/files

First, let's talk about the top-level directories:

```sh
book # Contains materials related to the online book

impl # Contains the latest source code of chibivue packages (runtime-core, runtime-dom, reactivity, compiler-core, compiler-dom, compiler-sfc, compiler-vapor, runtime-vapor, server-renderer, etc.)

examples # Contains sample code using the packages. Not directly related to the online book.

tools # Development and reader tools for the online book.

.github # Contains CI configuration files and contribution guides.
```

Now, let's take a closer look at the book directory.

```sh
book
  |- images # Contains image files used in the online book.
  |- online-book # The main body of the online book. It is a Vitepress project.
  |- impls # Contains the source code for each chapter.
```

## Guide about the method of contribution

### Before submitting a pull request

### Forking the repository

Access https://github.com/chibivue-land/chibivue and click on the `Fork` button on this page to fork it to your own account.

You can choose any name for the repository. Feel free to set other information as well.

### Setting up the local environment

#### Installing the necessary tools

- [Node.js](https://nodejs.org/en) (v24+)
- [pnpm](https://pnpm.io/) (v10+)
- [@antfu/ni](https://github.com/antfu/ni)
  ni is a great package manager wrapper created by [Anthony Fu](https://github.com/antfu). We assume the use of ni in the chibivue documentation.

### Getting Started

First, install the dependencies and set up the playground.

```sh
ni && nr setup
```

Then, you can start the development server.

```sh
nr dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| **Setup** | |
| `setup` | Install dependencies and generate playground |
| `setup:dev` | Generate playground files to examples/playground |
| `setup:vue` | Set up Vue.js core comparison environment |
| `setup:book` | Generate chibivue implementation for book readers |
| **Development** | |
| `dev` | Start playground dev server |
| `dev:app` | Start app example dev server |
| `dev:vapor` | Start vapor mode example dev server |
| `dev:vue` | Start Vue.js core dev server for comparison |
| **Build & Quality** | |
| `build` | Build all packages |
| `clean` | Remove all dist folders |
| `typecheck` | Run type checking (tsgo) |
| `lint` | Run linter (oxlint) |
| `lint:fix` | Run linter with auto-fix |
| `fmt` | Format code (oxfmt) |
| `fmt:check` | Check code formatting |
| `test` | Run tests once |
| `test:watch` | Run tests in watch mode |
| `check` | Run all checks (lint, fmt, typecheck, build, test) |
| **Book** | |
| `dev` | Start online book dev server |
| `build` | Build online book |
| `preview` | Preview built online book |
| `lint:text` | Lint book text |

### Running book chapter implementations

If you want to run the source code for each chapter, you can do so with the following command.

```sh
cd book/impls/${section-name}/${chapter-name}
nr dev
```

### Book Playground

The project includes a WebContainer-based playground (`book/playground`) that allows readers to try each chapter's implementation directly in the browser.

To start the playground:

```sh
nr playground:generate  # Generate chapter data from book/impls
nr playground           # Start the playground dev server
```

The playground supports:
- Selecting different chapters to explore
- Editing code with Monaco editor
- Running the development server in the browser
- Persisting edits to localStorage
- Resetting files to their original state

If you modify chapter implementations in `book/impls/`, run `nr playground:generate` to update the playground data.

#### Creating a branch (start making changes)

Clone the forked repository and create a branch.

Before creating a branch, make sure the upstream is set to the main branch.

As for the branch name, if it is related to a specific issue, please use the format `${issue-number}-${description (kebab-case)}`.  
Please make the description as clear and unique as possible.
There are no strict rules at the moment, but please avoid very short names or names that are too generic (lack uniqueness).  
If it is not related to a specific issue, the issue number is not necessary.

It would be helpful if you could create an issue whenever possible. It is not necessary for simple typo fixes.  
Also, if the changes are expected to be significant or critical in content, it would be appreciated if you could consult with @ubugeeei in advance.  
(If such changes are made without consultation, there is a possibility that the PR will be rejected depending on the case.)

### Creating commits

There are no strict rules regarding the content and granularity of commit messages to the working branch.

For commit messages, we have provided a configuration file for git-cz (changelog.config.cjs), so it is recommended to use it (but not required).

If you want to use git-cz, you need to install it locally.

```sh
npm install -g git-cz
```

```sh
# When you run the cz command with the staged changes, an interactive shell will start.
git cz
```

Of course, if you have any suggestions for the git-cz configuration file, please feel free to send a PR.

Regarding commit messages, if the issue number is included in the branch name, the issue number will be automatically included in the commit message.  
This is achieved by husky, and you can check the details in `/.husky/commit-msg`.

### Creating a Pull Request

Once you have finished making changes locally and pushed the changes, please create a Pull Request to the main branch of https://github.com/chibivue-land/chibivue.  
Please make the title and description of the Pull Request as clear as possible.  
Please always notify @ubugeeei when the work is completed to keep track of whether the work is in progress or completed.  
You can mention @ubugeeei in the PR comment. The same applies when the changes are completed after the review.
Also, please make sure to check that the CI has succeeded before reporting completion.

Basically, all PRs are managed by @ubugeeei, so please contact @ubugeeei for any inquiries.

## Guide about the contents of contribution

This is a guide to the changes you make. Here are a few points to keep in mind.

- When making changes to the online book, please make sure that the content is consistent across all language versions (English, Japanese, Simplified Chinese, Traditional Chinese).
- When making changes to the source code of each chapter, please appropriately incorporate those changes into the source code of subsequent chapters.
- When including images, figures, or text from other sources, please make sure to provide proper attribution.
