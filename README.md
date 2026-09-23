# Internship Roadmap - CriftTech Solutions

## Company Overview

CriftTech Solutions is a software development and IT solutions company based in Islamabad, Pakistan. The company specializes in custom software development, web and mobile applications, cloud solutions, ERP systems, and digital transformation consulting. It serves retail businesses, healthcare organizations, educational institutions, and e-commerce startups. The company follows Agile Scrum methodology with two-week sprint cycles.

## Internship Details

| Item | Information |
|---|---|
| Intern Name | Usman Ali |
| Registration No. | 8076 |
| Program | BSCS, 8th Semester |
| University | Abasyn University Islamabad Campus |
| Host Organization | CriftTech Solutions |
| Department | Web Development |
| Position | Software/Web Development Intern |
| Duration | 14 July 2026 to 15 September 2026 |


## Project: Bloom & Carry Cosmetics POS

An enterprise Point of Sale and Inventory Management System built for a cosmetics and beauty retail business. The system handles sales processing, inventory management, customer CRM, loyalty programs, returns and refunds, employee management, business intelligence analytics, and hardware integration (thermal printer, barcode scanner, cash drawer).

### Technologies Used

| Technology | Purpose |
|---|---|
| React 19 | Frontend UI |
| TypeScript | Type safety |
| Tailwind CSS 4 | Styling |
| Node.js + Express | Backend REST API |
| MongoDB Atlas | Cloud database |
| IndexedDB + LocalStorage | Offline-first storage |
| WebUSB / WebSerial | Hardware integration |
| ESC/POS | Thermal printer protocol |
| Render + Netlify | Deployment |

### Architecture

Three-tier offline-first architecture:
1. Instant Tier - LocalStorage and React state for zero-latency UI
2. Durable Vault Tier - IndexedDB for persistence across restarts
3. Cloud Tier - MongoDB Atlas with background sync and outbox queue

---

## 9-Week Roadmap

| Week | Dates | Focus Area | Key Tasks |
|---|---|---|---|
| 1 | 14 Jul - 20 Jul | Onboarding | Environment setup, codebase walkthrough, Git workflow training, login modal styling task |
| 2 | 21 Jul - 27 Jul | Frontend Development | Built POS Billing component, product catalog grid, search filtering, keyboard shortcuts, useMemo optimization |
| 3 | 28 Jul - 03 Aug | Backend Development | Bulk product import API, upsert operations, MongoDB indexing, bulk delete endpoints |
| 4 | 04 Aug - 10 Aug | Full-Stack Integration | Connected frontend to backend, sales checkout flow, barcode scanner integration, CORS configuration |
| 5 | 11 Aug - 17 Aug | Advanced POS Features | Tax Engine (inclusive/exclusive modes), thermal receipt printing via ESC/POS, WebUSB printer integration |
| 6 | 18 Aug - 24 Aug | Inventory Management | Products CRUD screen, Excel/CSV import/export, stock adjustment ledger, low-stock alerts |
| 7 | 25 Aug - 31 Aug | CRM and Operations | Customer CRM, loyalty points system, returns and refunds module, employee management and payroll |
| 8 | 01 Sep - 07 Sep | Business Intelligence | BI analytics dashboard, financial KPIs, MongoDB aggregation pipelines, custom SVG charts |
| 9 | 08 Sep - 15 Sep | Deployment and Handover | Deployed to Render and Netlify, automated test suite, documentation, handover session |

---

## Skills Acquired

| Category | Skills |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Hooks, Browser APIs |
| Backend | Node.js, Express.js, REST API design, TypeScript |
| Database | MongoDB Atlas, Aggregation Pipelines, Indexing, Bulk Operations |
| Hardware | ESC/POS, WebUSB, WebSerial, Code 128 barcodes |
| DevOps | Git, GitHub, Render, Netlify, Testing |
| Domain | POS architecture, Retail inventory, Offline-first design |

---

## Project Repository

https://github.com/usman-406/cloudsheet-web-pos

---

## Attendance Summary

| Week | Days Present |
|---|---|---|
| 1-9 | 5 each week | 

