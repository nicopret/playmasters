type ValidationIssue = {
    severity: 'error' | 'warning';
    stage: 'schema';
    domain: string;
    sourceId?: string;
    path: string;
    message: string;
}