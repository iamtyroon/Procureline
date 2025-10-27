# 07-Deployment

## Purpose

This folder contains all deployment-related documentation including infrastructure specifications, CI/CD configurations, release procedures, and deployment checklists.

## What Goes Here

- **Deployment guides**: Step-by-step deployment procedures
- **Infrastructure specifications**: Cloud resources, networking, security
- **CI/CD configurations**: Pipeline definitions and automation
- **Release notes**: Version changes and deployment history
- **Environment configurations**: Development, staging, production setups
- **Deployment checklists**: Pre/post-deployment verification steps
- **Rollback procedures**: Recovery plans for failed deployments

## Document Types

| Type | Description | Example |
|------|-------------|---------|
| Deployment Guide | Complete deployment procedure | `deployment-guide-production.md` |
| Infrastructure Spec | Cloud resource definitions | `infrastructure-aws-terraform.md` |
| CI/CD Pipeline | Automated deployment pipeline | `cicd-github-actions.yaml` |
| Release Notes | Version changelog | `release-notes-v1.2.0.md` |
| Environment Config | Environment-specific settings | `config-production-env.md` |
| Rollback Plan | Failure recovery procedure | `rollback-procedure.md` |

## BMAD Workflows That Output Here

- `/bmad:bmm:workflows:testarch-ci` → CI/CD configurations
- `/bmad:bmm:agents:dev` → Deployment guides
- `/bmad:bmm:agents:architect` → Infrastructure specs

## Deployment Lifecycle

1. **Planning**: Infrastructure and deployment strategy design
2. **Automation**: CI/CD pipeline configuration
3. **Testing**: Deployment tested in staging environments
4. **Documentation**: Procedures documented and reviewed
5. **Execution**: Production deployments following procedures
6. **Monitoring**: Post-deployment verification

## Key Principles

- **Automation**: Minimize manual deployment steps
- **Repeatability**: Same process works every time
- **Observability**: Monitor deployments and rollbacks
- **Safety**: Blue-green or canary deployment strategies
- **Documentation**: Keep runbooks current

## Related Folders

- **Architecture**: `02-Architecture/` - Deployment implements architecture
- **Specs**: `03-Technical-Specifications/` - Deployment uses API/DB specs
- **Testing**: `05-Testing/automation/` - CI pipeline runs tests
- **Operations**: `08-Operations/` - Operations uses deployment procedures
