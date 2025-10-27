# 08-Operations

## Purpose

This folder contains operational documentation for running and maintaining the production system including runbooks, monitoring setup, incident response procedures, and maintenance guides.

## What Goes Here

- **Runbooks**: Operational procedures for common tasks
- **Monitoring setup**: Observability and alerting configuration
- **Incident response**: Troubleshooting and resolution procedures
- **Maintenance guides**: Routine maintenance procedures
- **Performance tuning**: Optimization procedures
- **Backup and recovery**: Data protection procedures
- **SLA documentation**: Service level agreements and metrics

## Document Types

| Type | Description | Example |
|------|-------------|---------|
| Runbook | Step-by-step operational procedure | `runbook-database-backup.md` |
| Monitoring Config | Alerting and metrics setup | `monitoring-prometheus-setup.md` |
| Incident Response | Troubleshooting guide | `incident-response-high-latency.md` |
| Maintenance Guide | Routine maintenance tasks | `maintenance-database-cleanup.md` |
| Performance Guide | System optimization | `performance-tuning-api.md` |
| Recovery Procedure | Disaster recovery steps | `recovery-database-restore.md` |
| SLA Documentation | Service level commitments | `sla-api-availability.md` |

## BMAD Workflows That Output Here

- `/bmad:bmm:agents:dev` → Runbooks
- `/bmad:bmm:workflows:testarch-nfr` → Performance and SLA docs

## Operational Lifecycle

1. **Setup**: Initial monitoring and alerting configuration
2. **Documentation**: Runbooks created from operational experience
3. **Execution**: Procedures followed during operations
4. **Refinement**: Runbooks updated based on incidents
5. **Training**: Team onboarded to operational procedures

## Key Principles

- **Proactive**: Monitor and prevent issues before they occur
- **Documented**: All procedures written and accessible
- **Tested**: Runbooks validated through drills
- **Observable**: System behavior visible through metrics
- **Responsive**: Quick incident detection and resolution

## On-Call Procedures

Runbooks should enable any team member to:
1. Detect issues through alerts
2. Diagnose root causes
3. Execute remediation steps
4. Escalate when necessary
5. Document incidents for learning

## Related Folders

- **Architecture**: `02-Architecture/` - Operations implements architectural decisions
- **Deployment**: `07-Deployment/` - Operations uses deployment procedures
- **Retrospectives**: `09-Retrospectives/` - Incidents drive improvements
