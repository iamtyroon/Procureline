<a name="readme-top"></a>

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![Twitter][twitter-shield]][twitter-url]

<br />
<div align="center">
  <a href="https://github.com/iamtyroon/Procureline">
    <img src="procureline-video/assets/procureline%20logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Procureline</h3>

  <p align="center">
    Visual Block Programming for Multi-Tenant SaaS Procurement Planning & Automated Compliance
    <br />
    <a href="https://github.com/iamtyroon/Procureline"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/iamtyroon/Procureline">View Demo</a>
    ·
    <a href="https://github.com/iamtyroon/Procureline/issues">Report Bug</a>
    ·
    <a href="https://github.com/iamtyroon/Procureline/issues">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#architecture-layout-details">Architecture Layout Details</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#docker--kubernetes-deployment-guidelines">Docker & Kubernetes Deployment Guidelines</a></li>
    <li><a href="#security-warnings">Security Warnings</a></li>
    <li><a href="#testing-suite--benchmarks">Testing Suite & Benchmarks</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#contribution-guidelines">Contribution Guidelines</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## About The Project

[![Procureline Screen Shot][product-screenshot]](https://github.com/iamtyroon/Procureline)

Procureline is a multi-tenant SaaS platform designed to transform procurement management for organizations—ranging from universities and enterprises to government agencies. 

The platform addresses a critical operational gap: the majority of institutions still rely on manual, Excel-based procurement systems that create operational chaos, version control issues, compliance risks, and massive time waste. Procurement Officers typically spend over 40% of their time manually consolidating department spreadsheets and correcting errors.

Procureline solves these challenges through a **visual Blockly-based interface** for drag-and-drop procurement planning. This transforms hierarchical procurement data (Department → Category → Item) into intuitive, manipulable visual blocks. This approach auto-calculates totals, enforces budget limits, and calculates regulatory compliance in real-time.

### Key Innovations:
* **Visual Blockly Interface:** The only procurement platform utilizing visual block programming for hierarchical data, requiring zero user training.
* **Rapid Consolidation:** Procurement Officers can drag approved department plans into a master consolidation workspace, completing in hours what previously took weeks of copy-paste work.
* **Automated Compliance:** Built-in GOK compliance calculations (AGPO 30%, PWD 2%, Local Content 40%) for the Kenyan market, with an extensible architecture supporting additional compliance modules.
* **Bidirectional Excel Integration:** Preserves existing workflows by allowing Excel imports and generating government-standard, audit-ready reports.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![Next.js][Next.js]][Next-url]
* [![React][React.js]][React-url]
* [![Tailwind CSS][Tailwind]][Tailwind-url]
* [![NestJS][NestJS]][NestJS-url]
* [![Convex][Convex]][Convex-url]
* [![TypeScript][TypeScript]][TypeScript-url]
* [![Redis][Redis]][Redis-url]
* [![Docker][Docker]][Docker-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Architecture Layout Details

Procureline is built on a highly scalable, real-time, three-tier architecture designed for strict multi-tenant isolation and high performance.

```
                                 ┌─────────────────────────────────────┐
                                 │           PROCURELINE               │
                                 │      Enterprise Architecture        │
                                 └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          Next.js 16 (App Router)                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │   Blockly    │  │   Shadcn/ui  │  │  TailwindCSS │  │  TypeScript │  │    │
│  │  │  Workspace   │  │  Components  │  │   Styling    │  │    Strict   │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    Vercel                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRIMARY BACKEND                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           Convex Cloud                                   │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │  Real-time   │  │   Convex     │  │   Convex     │  │   Convex    │  │    │
│  │  │   Database   │  │     Auth     │  │   Functions  │  │   Storage   │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                 Convex Cloud                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            INTEGRATION MICROSERVICE                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         NestJS Microservice                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │    │
│  │  │   Stripe     │  │   IntaSend   │  │   Resend     │  │   Excel     │  │    │
│  │  │  Payments    │  │    M-Pesa    │  │    Email     │  │  Generation │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                               Railway / Render                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Frontend (Next.js 16 & Google Blockly)
* **Next.js 16 (App Router):** Leverages React 19, Server Components, and strict TypeScript.
* **Google Blockly Integration:** Custom block definitions (`department_block`, `category_block`, `item_block`) mapped to HSV colors to represent hierarchical procurement data.
* **Shadcn/ui & Tailwind CSS:** Modern Bento Box grid layout for dashboards, providing high information density and scannability.

### 2. Primary Backend (Convex Cloud)
* **Real-time Database:** Convex handles real-time data synchronization, automatic query caching, and reactive subscriptions.
* **Convex Auth:** Secure, integrated authentication supporting email/password, OTP, and session management.
* **Convex File Storage:** Handles Excel uploads, exports, and PDF storage.
* **Tenant Isolation:** Enforced at the database query level using `tenant_id` filters on all tables.

### 3. Integration Microservice (NestJS)
* **NestJS Microservice:** Handles complex integrations, background jobs, and heavy file processing.
* **BullMQ & Redis:** Manages background job queues (e.g., asynchronous Excel generation, email dispatching).
* **ExcelJS & pdf-lib:** Generates GOK-compliant Excel spreadsheets and PDF reports.
* **Payment Gateways:** Integrates Stripe for global card payments and IntaSend for Kenya-focused M-Pesa and bank transfers.

### 4. Role-Based Access Control (RBAC)
The system enforces a strict 4-layer user hierarchy:
1. **Platform Admin:** Full system access, tenant provisioning, global health monitoring, and billing operations.
2. **Tenant Admin:** Institutional management, billing, settings, and Procurement Officer management.
3. **Procurement Officer (PO):** Department setup, catalog management, plan review, and consolidation.
4. **Departmental User (DU):** Simplified workspace for building and submitting department-specific plans.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

Follow these steps to set up Procureline locally for development.

### Prerequisites

* **Node.js:** Version 20 LTS or higher.
* **Docker & Docker Compose:** Required for running local Redis and development tunnels.
* **NPM:** Package manager (comes with Node.js).

### Installation

1. **Clone the Repository:**
   ```sh
   git clone https://github.com/iamtyroon/Procureline.git
   cd Procureline
   ```

2. **Set Up Webapp Environment Variables:**
   Create `webapp/.env.local` based on `webapp/.env.example`:
   ```sh
   cp webapp/.env.example webapp/.env.local
   ```
   Fill in your Convex deployment details after running the Convex setup.

3. **Set Up NestJS Environment Variables:**
   Create `nestjs/.env` based on `nestjs/.env.example`:
   ```sh
   cp nestjs/.env.example nestjs/.env
   ```

4. **Install Dependencies:**
   Install dependencies for both the frontend webapp and the NestJS microservice:
   ```sh
   # Install webapp dependencies
   cd webapp
   npm install

   # Install NestJS dependencies
   cd ../nestjs
   npm install
   ```

5. **Start the Development Environment:**
   Procureline provides a unified development script in the webapp directory that spins up the Next.js frontend, Convex backend, local Redis, and NestJS microservice concurrently:
   ```sh
   cd ../webapp
   npm run dev
   ```

6. **Initialize Convex Schema & Seed Data:**
   In a new terminal window, run:
   ```sh
   cd webapp
   npx convex dev
   ```
   This will deploy your schema and start watching for backend function changes.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

### 1. Departmental User (DU) Workflow
* **Accessing the Workspace:** Log in using the department-scoped access code generated by your Procurement Officer (e.g., `2526-CS-A3X9`).
* **Building a Plan:** Drag category blocks from the toolbox onto the canvas, then nest item blocks inside them.
* **Entering Quantities:** Enter quantities for Q1-Q4. The system auto-calculates totals and updates the real-time budget meter.
* **Submitting:** Click "Submit to PO". The system runs validation checks to ensure the plan is not empty, has no zero-quantity items, and is within budget.

### 2. Procurement Officer (PO) Workflow
* **Catalog Setup:** Create departments, define categories, and populate the item catalog with standard unit prices.
* **Monitoring Submissions:** Track department submission statuses (Draft, Submitted, Approved, Returned) from the dashboard.
* **Consolidation:** Open the Consolidation Workspace. Drag approved department blocks into the master aggregate block.
* **Exporting:** Review compliance gauges (AGPO, PWD, Local Content) and click "Export to Excel" to download a GOK-compliant spreadsheet.

### 3. Running Local Redis Manually
If you need to run the in-memory Redis server independently of the main dev script:
```sh
cd nestjs
npm run start:redis
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Docker & Kubernetes Deployment Guidelines

### Local Docker Development
Procureline includes a `compose.yaml` file to run the entire stack locally in Docker containers.

To start the services:
```sh
docker compose up --build
```

#### The `tunnel-register` Service
When running in Docker, the `tunnel-register` service spins up a secure Cloudflared tunnel pointing to the NestJS microservice. It automatically registers this temporary tunnel URL in Convex as `NESTJS_URL`. This allows Convex serverless functions to communicate with your local NestJS container seamlessly.

### Production Deployment Guidelines

#### 1. NestJS Microservice (Railway / Render / AWS ECS)
* **Dockerize:** Use the provided `Dockerfile.dev` as a reference to build a production-ready multi-stage Docker image.
* **Environment Variables:** Ensure `REDIS_URL`, `CONVEX_URL`, and security secrets are injected.
* **Scaling:** Scale horizontally behind a load balancer. Ensure Redis is shared across instances to coordinate BullMQ queues.

#### 2. Frontend (Vercel)
* Deploy the `webapp` directory directly to Vercel for optimal Next.js 16 performance, edge caching, and automatic scaling.

#### 3. Database & Serverless Functions (Convex Cloud)
* Deploy Convex functions to production:
  ```sh
  cd webapp
  npx convex deploy
  ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Security Warnings

Procureline is designed with enterprise-grade security controls. Developers and administrators must adhere to the following security guidelines:

* **Tenant Data Isolation:** Isolation is enforced at the application level using strict `tenant_id` checks. Never write a Convex query or mutation that accesses tenant-specific tables without wrapping it in the `_tenantGuard` helper.
* **Mandatory 2FA:** Two-Factor Authentication is mandatory for all Platform Admin and Tenant Admin accounts. Do not bypass 2FA checks in production.
* **Input Sanitization:** All user inputs must be validated using Zod schemas on the frontend and Convex validators on the backend. Rich text or HTML inputs must be sanitized using DOMPurify to prevent Cross-Site Scripting (XSS).
* **CORS & Origin Policies:** The Next.js middleware (`webapp/proxy.ts`) evaluates origin policies. Ensure the allowed origins list is configured correctly in production to prevent unauthorized cross-origin requests.
* **Immutable Audit Logs:** Audit logs are append-only. Do not write functions that allow the deletion or modification of records in the `auditLogs` table.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Testing Suite & Benchmarks

### Running Tests

#### 1. Webapp & Convex Tests
The webapp features a comprehensive suite of integration and unit tests covering RBAC, tenant isolation, session management, and Blockly persistence.
To run the webapp tests:
```sh
cd webapp
npm run test
```
This compiles the test files using `tsconfig.tests.json` and executes them via the custom test runner `run-tests.ts`.

#### 2. NestJS Microservice Tests
NestJS uses Jest for unit and E2E testing.
To run NestJS tests:
```sh
cd nestjs
npm run test
```

### Performance Benchmarks

To maintain a highly responsive user experience, the codebase is optimized to meet the following performance targets:

| Operation | Target Latency | Measurement Metric |
|-----------|----------------|--------------------|
| **Blockly Workspace Load** | < 2.0 seconds | Time to interactive with 15+ departments |
| **Block Drag-and-Drop** | < 100ms | User action to visual snap update |
| **Real-Time Budget Calculation** | < 200ms | Quantity input change to budget meter update |
| **Excel Export Generation** | < 10.0 seconds | Click to download start for 500+ items |
| **Dashboard Page Load** | < 1.0 second | First Contentful Paint (FCP) |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] **Phase 1: Core MVP**
  - [x] Multi-tenant database architecture with strict isolation.
  - [x] Visual Blockly planning interface for Departmental Users.
  - [x] Real-time budget meters and validation guards.
  - [x] Drag-and-drop consolidation workspace for Procurement Officers.
  - [x] GOK-compliant Excel export (AGPO, PWD, Local Content).
- [ ] **Phase 2: Growth & Integrations**
  - [ ] Bidirectional Excel Import (parse existing plans into Blockly blocks).
  - [ ] Advanced multi-level approval workflows with email notifications.
  - [ ] Bento-box analytics dashboards for Tenant Admins.
  - [ ] In-app notification center and digest emails.
- [ ] **Phase 3: Enterprise Expansion**
  - [ ] SSO / SAML / Active Directory integration.
  - [ ] Custom compliance modules for other regions and industries.
  - [ ] Public REST API for ERP integrations.
  - [ ] AI-powered budget optimization and forecasting.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contribution Guidelines

To maintain code quality, security, and architectural consistency, please adhere to the following guidelines when contributing:

* **TypeScript Strict Mode:** All new code must compile under strict TypeScript rules. Avoid using `any` types; define explicit interfaces instead.
* **Convex Best Practices:** Ensure all database queries are optimized and utilize indexes defined in `schema.ts`. Always use the provided guard functions (`_roleGuard`, `_tenantGuard`) to secure endpoints.
* **Component Design:** When building UI components, extend shadcn/ui primitives and follow the Bento Box design patterns. Ensure full light/dark mode compatibility using Tailwind's `dark:` variants.
* **Test Coverage:** Any new feature or bug fix must be accompanied by corresponding tests in either the webapp test suite or NestJS Jest suite.
* **Linting & Formatting:** Run `npm run lint` before committing. Code must adhere to the project's ESLint and Prettier configurations.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Tyroon - [@notyroon](https://x.com/notyroon)

Project Link: [https://github.com/iamtyroon/Procureline](https://github.com/iamtyroon/Procureline)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

* [Google Blockly](https://developers.google.com/blockly)
* [Convex Cloud](https://www.convex.dev/)
* [NestJS Framework](https://nestjs.com/)
* [shadcn/ui](https://ui.shadcn.com/)
* [Tailwind CSS](https://tailwindcss.com)
* [Shields.io](https://shields.io)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

[contributors-shield]: https://img.shields.io/github/contributors/iamtyroon/Procureline.svg?style=for-the-badge
[contributors-url]: https://github.com/iamtyroon/Procureline/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/iamtyroon/Procureline.svg?style=for-the-badge
[forks-url]: https://github.com/iamtyroon/Procureline/network/members
[stars-shield]: https://img.shields.io/github/stars/iamtyroon/Procureline.svg?style=for-the-badge
[stars-url]: https://github.com/iamtyroon/Procureline/stargazers
[issues-shield]: https://img.shields.io/github/issues/iamtyroon/Procureline.svg?style=for-the-badge
[issues-url]: https://github.com/iamtyroon/Procureline/issues
[license-shield]: https://img.shields.io/github/license/iamtyroon/Procureline.svg?style=for-the-badge
[license-url]: https://github.com/iamtyroon/Procureline/blob/main/LICENSE
[twitter-shield]: https://img.shields.io/badge/-Twitter-black.svg?style=for-the-badge&logo=x&colorB=555
[twitter-url]: https://x.com/notyroon
[product-screenshot]: procureline-video/assets/Procureline_scrnshot.png

[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Tailwind]: https://img.shields.io/badge/tailwind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[NestJS]: https://img.shields.io/badge/nestjs-E0234E?style=for-the-badge&logo=nestjs&logoColor=white
[NestJS-url]: https://nestjs.com/
[Convex]: https://img.shields.io/badge/convex-FF4F00?style=for-the-badge&logo=convex&logoColor=white
[Convex-url]: https://www.convex.dev/
[TypeScript]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Redis]: https://img.shields.io/badge/redis-CC0000?style=for-the-badge&logo=redis&logoColor=white
[Redis-url]: https://redis.io/
[Docker]: https://img.shields.io/badge/docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[Docker-url]: https://www.docker.com/