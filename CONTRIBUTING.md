# Contributing to Agent Swarm

Thank you for your interest in contributing to Agent Swarm! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/swarm.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`
5. Make your changes
6. Test your changes
7. Commit your changes: `git commit -m "Add feature: your feature"`
8. Push to your fork: `git push origin feature/your-feature-name`
9. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- TypeScript knowledge
- For IntelliJ plugin: IntelliJ IDEA with Gradle

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build:core
npm run build:api
npm run build:web
npm run build:cli
```

### Development Mode

```bash
# Start all services in watch mode
npm run dev

# Start individual services
npm run dev:core
npm run dev:api
npm run dev:web
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Follow existing code patterns
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer `async/await` over promises
- Handle errors appropriately

### File Organization

- Keep files focused on a single responsibility
- Use consistent naming conventions
- Group related functionality together

### Error Handling

- Always handle errors appropriately
- Use try-catch blocks for async operations
- Log errors with context
- Return meaningful error messages

## Testing

Before submitting a PR, ensure:

1. All existing tests pass
2. New code is covered by tests
3. No linter errors
4. Code builds successfully

## Commit Messages

Follow conventional commit format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(orchestrator): add parallel task execution
fix(api): validate task description length
docs(readme): update installation instructions
```

## Pull Request Process

1. Ensure your branch is up to date with main
2. Write clear commit messages
3. Add tests for new features
4. Update documentation as needed
5. Ensure all checks pass
6. Request review from maintainers

## Code Review

- Be respectful and constructive
- Focus on code quality and correctness
- Ask questions if something is unclear
- Suggest improvements when appropriate

## Adding New Features

### Adding a New Agent

1. Create agent class extending `BaseAgent`
2. Implement required methods
3. Register agent in `Swarm` class
4. Add tests
5. Update documentation

### Adding a New LLM Provider

1. Create provider class extending `BaseLLMProvider`
2. Implement required methods
3. Add to provider factory
4. Add tests
5. Update documentation

### Adding API Endpoints

1. Create route handler
2. Add input validation
3. Add authentication middleware
4. Add error handling
5. Update API documentation
6. Add tests

## Reporting Issues

When reporting issues, please include:

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs or error messages

## Questions?

Feel free to open an issue for questions or discussions about the project.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

