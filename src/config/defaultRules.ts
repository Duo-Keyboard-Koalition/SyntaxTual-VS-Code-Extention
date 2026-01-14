import { ReviewRule } from '../models';

export const DEFAULT_RULES: ReviewRule[] = [
    {
        id: 'security-hardcoded-secrets',
        name: 'Hardcoded Secrets Detection',
        description: 'Detects hardcoded API keys, passwords, and tokens',
        enabled: true,
        severity: 'error',
        pattern: '(api[_-]?key|password|secret|token)\\s*[=:]\\s*["\'][^"\']+["\']',
        prompt: 'Check for hardcoded secrets, API keys, passwords, or tokens that should be in environment variables'
    },
    {
        id: 'security-sql-injection',
        name: 'SQL Injection Risk',
        description: 'Detects potential SQL injection vulnerabilities',
        enabled: true,
        severity: 'error',
        prompt: 'Identify potential SQL injection vulnerabilities where user input is concatenated into SQL queries'
    },
    {
        id: 'perf-n-plus-one',
        name: 'N+1 Query Detection',
        description: 'Detects potential N+1 query patterns in loops',
        enabled: true,
        severity: 'warning',
        prompt: 'Identify N+1 query patterns where database queries or API calls are made inside loops'
    },
    {
        id: 'code-unused-variables',
        name: 'Unused Variables',
        description: 'Detects declared but unused variables',
        enabled: true,
        severity: 'info',
        prompt: 'Find variables that are declared but never used in the code'
    },
    {
        id: 'logic-null-check',
        name: 'Missing Null Checks',
        description: 'Detects potential null/undefined access',
        enabled: true,
        severity: 'warning',
        prompt: 'Identify places where null or undefined values might cause runtime errors'
    },
    {
        id: 'code-error-handling',
        name: 'Error Handling',
        description: 'Checks for proper error handling',
        enabled: true,
        severity: 'warning',
        prompt: 'Find try-catch blocks that swallow errors silently or have empty catch blocks'
    },
    {
        id: 'perf-memory-leak',
        name: 'Potential Memory Leaks',
        description: 'Detects patterns that may cause memory leaks',
        enabled: true,
        severity: 'warning',
        prompt: 'Identify potential memory leaks such as unremoved event listeners, unclosed resources, or circular references'
    },
    {
        id: 'style-naming-convention',
        name: 'Naming Convention',
        description: 'Checks for consistent naming conventions',
        enabled: true,
        severity: 'info',
        prompt: 'Check if naming conventions are consistent (camelCase for variables, PascalCase for classes, etc.)'
    },
    {
        id: 'code-complexity',
        name: 'Code Complexity',
        description: 'Flags overly complex functions',
        enabled: true,
        severity: 'info',
        prompt: 'Identify functions with high cyclomatic complexity or deeply nested conditions that could be simplified'
    },
    {
        id: 'code-duplication',
        name: 'Code Duplication',
        description: 'Detects duplicated code blocks',
        enabled: true,
        severity: 'info',
        prompt: 'Find duplicated code blocks that could be refactored into reusable functions'
    }
];
