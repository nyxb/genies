# Genies CLI

Genies CLI is a powerful tool for adding React components to your projects. It provides an easy way to initialize projects and add components while automatically installing all required dependencies.

## Installation

Make sure you have Node.js and npm or pnpm installed. You can use the CLI directly with `npx` without installing it globally:

```bash
npx genies init
```

## Usage

### Initialize Project

Use the `init` command to initialize dependencies for a new project. The `init` command installs dependencies, adds the `ny` utility, configures `tailwind.config.ts`, and sets up CSS variables for the project.

```bash
npx genies init
```

### Add Components

Use the `add` command to add components to your project. The `add` command adds a component to your project and installs all required dependencies.

```bash
npx genies add [component]
```

#### Example

```bash
npx genies add alert-dialog
```

You can also run the command without any arguments to view a list of all available components:

```bash
npx genies add
```

### Options

- `-y, --yes`: Skip confirmation prompt.
- `-o, --overwrite`: Overwrite existing files.
- `-c, --cwd <cwd>`: The working directory. Defaults to the current directory.
- `-p, --path <path>`: The path to add the component to.

## Documentation

Visit [https://nyxbui.design/docs/cli](https://nyxbui.design/docs/cli) to view the full documentation.

## License

Licensed under the [MIT License](https://github.com/nyxb/nyxbui/blob/main/LICENSE.md).
