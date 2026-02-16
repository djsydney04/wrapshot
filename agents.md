# AI Agent Software Engineering Best Practices

This document defines the software engineering best practices that all AI coding assistants (Claude Code, Antigravity, Cursor, Gemini CLI, and Codex) must follow when working on this project.

---

## Table of Contents

1. [Code Quality & Standards](#code-quality--standards)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [TypeScript & Type Safety](#typescript--type-safety)
4. [React & Next.js Best Practices](#react--nextjs-best-practices)
5. [Database & Supabase](#database--supabase)
6. [Testing & Validation](#testing--validation)
7. [Git & Version Control](#git--version-control)
8. [Security & Authentication](#security--authentication)
9. [Performance & Optimization](#performance--optimization)
10. [Documentation & Comments](#documentation--comments)
11. [Error
 Handling](#error-handling)
12. [Code Review Checklist](#code-review-checklist)

---

## Code Quality & Standards

### General Principles

- **DRY (Don't Repeat Yourself)**: Extract repeated logic into reusable functions, hooks, or components
- **SOLID Principles**: Follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
- **KISS (Keep It Simple, Stupid)**: Prefer simple, readable solutions over clever, complex ones
- **YAGNI (You Aren't Gonna Need It)**: Don't add functionality until it's necessary

### Code Style

- Use **Prettier** for consistent formatting (already configured in the project)
- Use **ESLint** for code quality checks
- Follow the project's existing naming conventions:
  - `camelCase` for variables and functions
  - `PascalCase` for components, classes, and types
  - `UPPER_SNAKE_CASE` for constants
  - `kebab-case` for file names (except components)
- Maximum line length: **100 characters** (configurable, but be consistent)
- Use **meaningful variable names** that describe their purpose
- Avoid abbreviations unless they're widely understood (e.g., `id`, `url`, `api`)

### File Organization

```
apps/web/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Route groups for authentication
│   ├── (dashboard)/       # Route groups for dashboard
│   └── api/               # API routes
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   └── features/         # Feature-specific components
├── lib/                  # Utility functions and configurations
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Helper functions
│   └── types/           # Shared TypeScript types
└── public/              # Static assets
```

---

## Architecture & Design Patterns

### Component Architecture

- **Atomic Design**: Organize components from atoms → molecules → organisms → templates → pages
- **Container/Presentational Pattern**: Separate logic (containers) from UI (presentational components)
- **Composition over Inheritance**: Use composition to build complex components from simpler ones

### State Management

- Use **React Server Components** by default for data fetching
- Use **useState** for local component state
- Use **useReducer** for complex state logic
- Use **Context API** sparingly for truly global state (theme, auth, etc.)
- Consider **Zustand** or **Jotai** for client-side global state if needed
- Avoid prop drilling beyond 2-3 levels

### Data Fetching

- Prefer **Server Components** for initial data fetching
- Use **Server Actions** for mutations
- Use **React Query/TanStack Query** for client-side data fetching and caching
- Implement proper **loading states** and **error boundaries**
- Use **Suspense** for async components

---

## TypeScript & Type Safety

### Type Safety Rules

- **Never use `any`** unless absolutely necessary (document why if you must)
- Use **strict mode** in `tsconfig.json`
- Prefer **interfaces** for object shapes, **types** for unions/intersections
- Use **generics** for reusable, type-safe functions and components
- Define **explicit return types** for functions (especially public APIs)
- Use **const assertions** for literal types
- Leverage **discriminated unions** for complex state

### Type Organization

```typescript
// ✅ Good: Explicit, well-defined types
interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

type UserRole = 'admin' | 'user' | 'guest';

// ❌ Bad: Using any
function processData(data: any) { ... }

// ✅ Good: Using generics
function processData<T extends Record<string, unknown>>(data: T): T { ... }
```

### Database Types

- Use **Supabase's generated types** from the database schema
- Keep types in sync with database schema using `supabase gen types`
- Create **domain-specific types** that extend database types when needed

---

## React & Next.js Best Practices

### Component Best Practices

```typescript
// ✅ Good: Server Component by default
export default async function ProjectsPage() {
  const projects = await getProjects();
  return <ProjectList projects={projects} />;
}

// ✅ Good: Client Component when needed
'use client';

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### Performance Optimization

- Use **dynamic imports** for code splitting
- Implement **lazy loading** for images and heavy components
- Use **React.memo** for expensive components (but measure first)
- Optimize **bundle size** by analyzing with `next bundle-analyzer`
- Use **Next.js Image component** for automatic optimization
- Implement **pagination** or **infinite scroll** for large lists

### Routing & Navigation

- Use **Next.js App Router** conventions
- Use **route groups** `(groupName)` for organization without affecting URLs
- Use **parallel routes** `@folder` for simultaneous rendering
- Use **intercepting routes** `(..)folder` for modals and overlays
- Implement **loading.tsx** and **error.tsx** for better UX

---

## Database & Supabase

### Query Best Practices

```typescript
// ✅ Good: Select only needed columns
const { data } = await supabase
  .from('projects')
  .select('id, name, created_at')
  .eq('user_id', userId);

// ❌ Bad: Select all columns
const { data } = await supabase
  .from('projects')
  .select('*');

// ✅ Good: Use joins efficiently
const { data } = await supabase
  .from('projects')
  .select(`
    id,
    name,
    owner:users!owner_id(id, name)
  `);
```

### Database Design

- Use **UUIDs** for primary keys (already configured)
- Implement **Row Level Security (RLS)** for all tables
- Create **indexes** for frequently queried columns
- Use **foreign keys** to maintain referential integrity
- Use **timestamps** (`created_at`, `updated_at`) on all tables
- Use **soft deletes** (`deleted_at`) instead of hard deletes when appropriate

### Migrations

- Always create **reversible migrations** when possible
- Test migrations in **local environment** before production
- Use **descriptive names** for migration files
- Document **breaking changes** in migration comments
- Run `supabase db reset` locally to test from scratch

---

## Testing & Validation

### Testing Strategy

- Write **unit tests** for utility functions and hooks
- Write **integration tests** for API routes and server actions
- Write **E2E tests** for critical user flows
- Aim for **>80% code coverage** on business logic
- Use **Test-Driven Development (TDD)** for complex features

### Testing Tools

- **Vitest** or **Jest** for unit testing
- **React Testing Library** for component testing
- **Playwright** or **Cypress** for E2E testing
- **MSW (Mock Service Worker)** for API mocking

### Input Validation

```typescript
// ✅ Good: Use Zod for runtime validation
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  budget: z.number().positive(),
});

type CreateProjectInput = z.infer<typeof createProjectSchema>;
```

---

## Git & Version Control

### Commit Messages

Follow **Conventional Commits** format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

**Examples:**
```
feat(auth): add Google OAuth integration

fix(dashboard): resolve budget calculation error

docs(readme): update installation instructions
```

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/<name>` - New features
- `fix/<name>` - Bug fixes
- `hotfix/<name>` - Urgent production fixes

### Pull Request Guidelines

- Keep PRs **small and focused** (< 400 lines changed)
- Write **descriptive PR titles** and descriptions
- Link **related issues** in PR description
- Request **at least one review** before merging
- Ensure **all checks pass** (tests, linting, type checking)
- **Squash commits** when merging to keep history clean

---

## Security & Authentication

### Authentication

- Use **Supabase Auth** for authentication
- Implement **proper session management**
- Use **HTTP-only cookies** for session tokens
- Implement **CSRF protection** for forms
- Use **secure password requirements** (min length, complexity)

### Authorization

- Implement **Row Level Security (RLS)** on all Supabase tables
- Use **role-based access control (RBAC)** where appropriate
- Validate **user permissions** on both client and server
- Never trust **client-side authorization** alone

### Data Protection

- **Never commit secrets** to version control
- Use **environment variables** for sensitive data
- Implement **input sanitization** to prevent XSS
- Use **parameterized queries** to prevent SQL injection
- Implement **rate limiting** on API endpoints
- Use **HTTPS** in production (enforced by Next.js)

### Security Checklist

- [ ] All environment variables are in `.env.local` (not committed)
- [ ] RLS policies are enabled on all tables
- [ ] User input is validated and sanitized
- [ ] Authentication is required for protected routes
- [ ] API routes validate user permissions
- [ ] Sensitive data is encrypted at rest

---

## Performance & Optimization

### Frontend Performance

- Use **Server Components** by default
- Implement **code splitting** with dynamic imports
- Optimize **images** with Next.js Image component
- Use **font optimization** with `next/font`
- Implement **caching strategies** (ISR, SSG, etc.)
- Minimize **JavaScript bundle size**
- Use **CDN** for static assets

### Backend Performance

- Implement **database indexes** on frequently queried columns
- Use **connection pooling** for database connections
- Implement **caching** with Redis or similar (if needed)
- Use **pagination** for large datasets
- Optimize **N+1 queries** with proper joins
- Implement **rate limiting** to prevent abuse

### Monitoring

- Use **Vercel Analytics** for performance monitoring
- Implement **error tracking** with Sentry or similar
- Monitor **Core Web Vitals** (LCP, FID, CLS)
- Set up **logging** for critical operations
- Monitor **database performance** with Supabase dashboard

---

## Documentation & Comments

### Code Documentation

```typescript
/**
 * Calculates the total budget for a project including all line items.
 * 
 * @param projectId - The unique identifier of the project
 * @param includeArchived - Whether to include archived line items
 * @returns The total budget amount in cents
 * @throws {ProjectNotFoundError} If the project doesn't exist
 * 
 * @example
 * const total = await calculateProjectBudget('proj_123', false);
 * console.log(total); // 150000 (represents $1,500.00)
 */
async function calculateProjectBudget(
  projectId: string,
  includeArchived = false
): Promise<number> {
  // Implementation
}
```

### When to Comment

- **Do comment:**
  - Complex algorithms or business logic
  - Non-obvious workarounds or hacks
  - Public API functions (use JSDoc)
  - Regular expressions
  - Magic numbers or constants

- **Don't comment:**
  - Obvious code (let the code speak for itself)
  - Commented-out code (delete it, it's in git history)
  - Redundant information

### README Files

- Every **package** should have a README
- Include **installation instructions**
- Document **environment variables**
- Provide **usage examples**
- List **available scripts**
- Document **API endpoints** if applicable

---

## Error Handling

### Error Handling Patterns

```typescript
// ✅ Good: Specific error handling
try {
  const project = await getProject(id);
  if (!project) {
    throw new NotFoundError(`Project ${id} not found`);
  }
  return project;
} catch (error) {
  if (error instanceof NotFoundError) {
    return { error: 'Project not found', status: 404 };
  }
  if (error instanceof UnauthorizedError) {
    return { error: 'Unauthorized', status: 401 };
  }
  // Log unexpected errors
  console.error('Unexpected error:', error);
  return { error: 'Internal server error', status: 500 };
}

// ❌ Bad: Generic error handling
try {
  const project = await getProject(id);
  return project;
} catch (error) {
  console.log('Error:', error);
  return null;
}
```

### Custom Error Classes

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

### Error Boundaries

- Implement **React Error Boundaries** for graceful error handling
- Use **error.tsx** files in Next.js for route-level error handling
- Provide **user-friendly error messages**
- Log errors to **monitoring service** (Sentry, etc.)

---

## Code Review Checklist

Before submitting code for review or merging, ensure:

### Functionality
- [ ] Code works as intended
- [ ] Edge cases are handled
- [ ] Error handling is implemented
- [ ] Loading and error states are shown to users

### Code Quality
- [ ] Code follows project conventions
- [ ] No code duplication (DRY principle)
- [ ] Functions are small and focused
- [ ] Variable names are descriptive
- [ ] No commented-out code
- [ ] No console.logs in production code

### Type Safety
- [ ] No `any` types (or documented why)
- [ ] All functions have return types
- [ ] Types are properly exported/imported
- [ ] Database types are up to date

### Performance
- [ ] No unnecessary re-renders
- [ ] Images are optimized
- [ ] Database queries are efficient
- [ ] No N+1 query problems

### Security
- [ ] User input is validated
- [ ] Authentication is checked
- [ ] Authorization is enforced
- [ ] No secrets in code
- [ ] RLS policies are correct

### Testing
- [ ] Unit tests are written
- [ ] Tests pass locally
- [ ] Edge cases are tested
- [ ] Error cases are tested

### Documentation
- [ ] Complex logic is commented
- [ ] Public APIs are documented
- [ ] README is updated if needed
- [ ] Environment variables are documented

### Git
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with base branch
- [ ] No merge conflicts
- [ ] PR description is clear

---

## AI Agent Specific Guidelines

### When Making Changes

1. **Understand the context**: Read related files before making changes
2. **Follow existing patterns**: Match the style and structure of existing code
3. **Test your changes**: Run linting, type checking, and tests
4. **Explain your reasoning**: Document why you made specific decisions
5. **Ask for clarification**: If requirements are unclear, ask before implementing

### What to Avoid

- ❌ Making changes without understanding the codebase
- ❌ Introducing new patterns without discussion
- ❌ Breaking existing functionality
- ❌ Ignoring TypeScript errors
- ❌ Skipping tests
- ❌ Committing secrets or sensitive data

### Best Practices for AI Agents

- ✅ Read the existing code structure before suggesting changes
- ✅ Use the project's existing dependencies (don't add new ones without asking)
- ✅ Follow the established file organization
- ✅ Maintain consistency with existing code style
- ✅ Provide explanations for complex changes
- ✅ Suggest improvements when you see opportunities

---

## Project-Specific Conventions

### This Project (ProdAI/Wrapshot)

- **Tech Stack**: Next.js 14+, React, TypeScript, Supabase, TailwindCSS
- **Monorepo**: Uses Turborepo for managing multiple packages
- **Package Manager**: npm (as evidenced by `package-lock.json`)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: TailwindCSS with custom design system
- **Deployment**: Vercel (assumed based on Next.js)

### Running Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run tests
npm run test

# Build for production
npm run build

# Supabase commands
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > types/supabase.ts
```

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## Conclusion

These best practices are living guidelines that should evolve with the project. All AI agents working on this codebase should:

1. **Prioritize code quality** over speed
2. **Maintain consistency** with existing patterns
3. **Think about maintainability** for future developers
4. **Consider security** in every change
5. **Write tests** for new functionality
6. **Document complex logic** clearly

When in doubt, ask for clarification rather than making assumptions.

---

**Last Updated**: 2026-02-02  
**Maintained By**: Project Team  
**Version**: 1.0.0
