# Product Requirements Document
## Health Insurance Employer Onboarding & Implementation System

**Version:** 1.0  
**Date:** July 20, 2026  
**Prepared By:** Implementation Team  
**Document Status:** Draft — For Prototype Development

---

## 1. Executive Summary

This document defines requirements for a web-based client onboarding and implementation management system for a regional health insurance company specializing in employer-sponsored coverage. The system enables implementation managers to create unique, password-protected client profiles, guide clients and broker partners through a structured onboarding workflow, track deliverables against a policy effective date, and centralize all relevant information in one accessible interface. Data entered in the system syncs to an external spreadsheet (Google Sheets or Microsoft Excel/OneDrive).

---

## 2. Goals & Success Criteria

| Goal | Success Criteria |
|---|---|
| Streamline client onboarding | A new client profile can be fully configured in under 15 minutes |
| Centralize client data | All sections (2–7) accessible from a single dashboard without page reloads |
| Drive accountability | Deliverable completion is visually tracked and timestamped |
| Support self-service | Clients and brokers can log in, review their checklist, and mark items complete without implementation manager involvement |
| Enable customization | Standard workflows can be edited at both the global template level and the individual client level |
| Data portability | Sections 2–3 sync to Google Sheets or Excel in real time |

---

## 3. User Roles & Permissions

| Role | Description | Permissions |
|---|---|---|
| **Implementation Manager** | Internal staff managing client onboarding | Full CRUD on all sections; can create/delete client profiles; can edit global workflow templates; can manage contacts |
| **Client (Employer)** | Employer group purchasing coverage | Read access to their profile; can mark deliverable checkboxes; can check off "What to Expect" items; cannot edit data fields |
| **Broker/Benefit Advisor** | Selling and servicing the policy | Read access to their client's profile; can mark deliverable checkboxes; cannot edit core data fields |

> **Note:** Future versions should support granular permission toggling per client instance (e.g., granting a specific broker edit access to their section).

---

## 4. System Architecture Overview

### 4.1 Multi-Tenant Client Profiles
- Each client is represented as a unique **instance** (profile/record) within the system.
- Every instance has its own URL slug or ID (e.g., `/clients/acme-corp`).
- Instances are isolated; users only see data for clients they are credentialed to access.

### 4.2 Authentication
- Each client instance is **password protected**.
- Login screen collects: username (email) + password.
- Upon successful login, the user is routed directly to their specific client dashboard.
- Implementation managers access an admin panel to manage all instances.
- Password reset via email link.
- Session timeout after 30 minutes of inactivity (configurable).

### 4.3 Navigation
- Persistent **left sidebar** with labeled navigation links for each section:
  - Dashboard / Overview
  - Section 1: Client Questionnaire
  - Section 2: Broker/Benefit Advisor Questionnaire
  - Section 3: Deliverables & Timeline
  - Section 4: Contacts
  - Section 5: What to Expect
  - Section 6: Document Center
- Active section is highlighted in the sidebar.
- Sidebar is collapsible on smaller screens.

### 4.4 Data Export & Spreadsheet Sync
- **Sections 1 and 2** (Client Questionnaire and Broker Questionnaire) sync to an external spreadsheet:
  - **Google Sheets:** via Google Sheets API (OAuth 2.0); each client instance maps to a row or a dedicated tab.
  - **Microsoft Excel / OneDrive:** via Microsoft Graph API (OAuth 2.0).
- Sync is triggered on save. A sync status indicator (last synced timestamp) is visible in the UI.
- Implementation managers configure the spreadsheet destination at the global level or per-client.

### 4.5 Workflow Templates
- A **global standard workflow** defines the default fields and deliverables for all new client profiles.
- Implementation managers can **edit the global template**, which applies to all future new instances.
- Each individual client instance inherits the standard workflow at creation but can be independently modified without affecting other instances or the global template.

---

## 5. Client Portal View Specifications

---

### Section 1: Client Questionnaire

**Purpose:** Capture all essential employer group information.  
**Editable by:** Implementation Manager  
**Synced to:** External spreadsheet (Sections 1 & 2)

#### Fields

| Field | Type | Notes |
|---|---|---|
| **General Information** | | |
| Company Name | Text | Required |
| Company Address (Street, City, State, ZIP) | Text (multi-line) | Required |
| Tax ID Number (EIN) | Text | Masked input; format XX-XXXXXXX |
| SIC Code | Text | Optional lookup/search |
| Type of Organization | Radio Buttons for "LLC/LLP", "C-Corp", "S-Corp", "Partnership", "Sole Proprietorship", "Other" | |
| Company Size (# of Employees) | Number | |
| Number of Locations | Text | |
| **Points of Contact** | | |
| → Main Contact: Name, Title, Phone, Email | Text fields | |
| → Main Contact: Is Main Signatory? | Checkbox | |
| → Main Contact: Is Main Billing Contact? | Checkbox | |
| → Secondary Contact: Name, Title, Phone, Email | Text fields | |
| → Secondary Contact: Is Main Signatory? | Checkbox | |
| → Secondary Contact: Is Main Billing Contact? | Checkbox | |
| **Plan Information** | | |
| Policy Effective Date | Date picker | **Drives timeline in Section 3** |
| Waiting Period for New Hires | Test | Subtext with the text "Common Examples: First month after date of hire, On date of hire, First of Month following a waiting period of XX days" |
| Excluded Classes | Checkboxes (None, Salary, Hourly, Part-Time, Retiree, Other) | |
| High-Performance Network Selection | Dropdown (39North Network, None) | |
| National Network Selection | Dropdown (Logro Network (recommended), First Health, PCHS, Other) | |
| **Client Notes** | | |
| Client Notes | Text area | Free-form |

**UI Behavior:**
- All fields are editable in-place with an **Edit / Save** toggle.
- Additional fields should be able to added or removed. 
- Required fields are validated before saving.
- A "Save & Sync" button pushes data to the connected spreadsheet or database, if connected. 
- Sensitive fields (EIN) are masked by default; reveal on click with re-authentication prompt.

---

### Section 2: Broker/Benefit Advisor Questionnaire

**Purpose:** Capture all essential broker/firm information.  
**Editable by:** Implementation Manager  
**Synced to:** External spreadsheet (Sections 1 & 2)

#### Fields

| Field | Type | Notes |
|---|---|---|
| **General Information** | | |
| Broker Name | Text | Required |
| Firm Name | Text | Required |
| Firm Address (Street, City, State, ZIP) | Text (multi-line) | |
| Firm Tax ID Number (EIN) | Text | Masked; format XX-XXXXXXX |
| **Points of Contact** | | |
| → Main Contact: Name, Title, Phone, Email | Text fields | |
| → Main Contact: Is Main Billing Contact? | Checkbox | |
| → Secondary Contact: Name, Title, Phone, Email | Text fields | |
| → Secondary Contact: Is Main Billing Contact? | Checkbox | |
| **Vendor Integrations** | | |
| Benefits Admin Platform Integration Required? | Toggle (Yes/No) | If Yes, show next field |
| → Platform Name | Text | Conditional; required if above = Yes |
| COBRA Vendor Name | Text | |
| COBRA Vendor Contact Name | Text | |
| COBRA Vendor Contact Phone | Text | |
| COBRA Vendor Contact Email | Text | |
| Broker Notes | Text area | Free-form |

**UI Behavior:** Same as Section 1 (Edit/Save toggle, additional fields, validation, masked sensitive fields, Save & Sync).

---

### Section 3: Deliverables Checklist & Timeline

**Purpose:** Track all pre- and post-effective-date deliverables tied to the policy effective date from Section 1.  
**Templated Deliverables:** The deliverables should be automatically created from a template located on the admin portal. When a new client is created, the template for deliverables should automatically populate.
**Editable by:** Implementation Manager (to add/edit/remove deliverables); clients and brokers can mark checkboxes.

#### 3.1 Timeline Auto-Generation
- When the **Policy Effective Date** is saved in Section 1, the system automatically calculates and populates all deliverable due dates.
- If the effective date changes, the system recalculates and prompts the user to confirm updated dates.

#### 3.2 Visual Timeline
- A horizontal or vertical timeline view is displayed at the top of this section, showing all deliverables plotted against their due dates.
- Items are color-coded: **Upcoming** (default), **Due Soon** (within 7 days, amber), **Overdue** (red), **Completed** (green with strikethrough and checkmark).

#### 3.3 Deliverables List

Each deliverable record includes:
- **Deliverable Name** (editable)
- **Due Date** (auto-calculated; editable override)
- **Due Date Rule** (e.g., "45 days before effective date") — shown as a label
- **Special Notes / Alerts** (editable text; alerts displayed as a warning badge)
- **Completed checkbox** — when checked, the row visually marks as complete (green background, checkmark icon, timestamp of completion, and name of user who marked it)
- **Delete / Add** controls (Implementation Manager only)

#### 3.4 Standard Deliverables

**Pre-Effective Date:**

| Deliverable | Due Date Rule | Alert / Note |
|---|---|---|
| Sign and accept stoploss rate sheet; select plan designs | 45 days before effective date | |
| Collect group and broker W9s & banking information | 30 days before effective date | |
| Receive Summary of Benefits and Coverage for selected plans | 30 days before effective date | |
| Host open enrollment meetings with employees | 30 days before effective date | |
| Submit final enrollment census after open enrollment | 20 days before effective date | |
| Receive and sign final rates | 14 days before effective date | ⚠️ Note: Rates may change based on final enrollment |
| Sign Master Stoploss Policy | 10 days before effective date | 🔴 Alert: Required to send ID cards |
| Sign ACH Authorization document | 10 days before effective date | 🔴 Alert: Required to send ID cards |
| Sign Stoploss Application and Disclosure Form | 10 days before effective date | 🔴 Alert: Required to send ID cards |
| Receive and review first premium invoice | 10 days before effective date | ⚠️ Note: Recommend detailed review for accuracy |

**Post-Effective Date:**

| Deliverable | Due Date Rule | Alert / Note |
|---|---|---|
| Receive virtual ID cards | On effective date | |
| Receive physical ID cards (shipped to member addresses) | Within 20 days after effective date | |
| Review and sign the issued stoploss policy | 20 days after effective date | |
| Review and sign Aggregate Accommodation policy, Advance Specific Excess Loss Agreement, and Indemnity Agreement | 20 days after effective date | |
| Receive and sign Summary Plan Documents | Within 60 days after effective date | Note: In-depth plan coverage and exclusion documents |
| Sign Administrative Services Agreement Bundle (TPA, PBM, BAA/HIPAA contracts) | Within 90 days after effective date | |

#### 3.5 Workflow Editability
- Implementation managers can add new deliverables, edit any existing deliverable (name, date rule, notes), or delete deliverables.
- Changes apply only to the current client instance unless the manager explicitly updates the global template.
- A **"Reset to Standard Workflow"** option restores the global default deliverables for the current instance (with a confirmation dialog).

---

### Section 4: Contacts

**Purpose:** Provide a clear, centralized directory of all contacts relevant to this client's implementation.  
**Managed by:** Implementation Manager  
**Visible to:** All users with access to this client instance

#### 4.1 Contact Record Fields

| Field | Type |
|---|---|
| Contact Name | Text |
| Company Name | Text |
| Phone Number | Text |
| Email | Text (email format validated) |
| Roles & Responsibilities | Text area |
| Main Contact? | Checkbox (one main contact per client) |

#### 4.2 Contact Management
- Contacts are displayed as **cards** in a grid or list view.
- **Add Contact** button opens a modal form with the fields above.
- Each contact card has **Edit** and **Remove** buttons.
- **Contacts are saved to a global contact library** and can be searched and reused when creating contacts for future clients (type-ahead search by name or company).
- Removing a contact from a client instance does not delete them from the global library.

---

### Section 5: What to Expect

**Purpose:** Educate clients, members, and brokers on plan nuances, transition expectations, and operational processes.  
**Managed by:** Implementation Manager (to edit/add/remove items)
**Templated Expectations & FAQs:** The expectations should be automatically created from a template located on the admin portal. When a new client is created, the template for expectations & FAQs should automatically populate, but individual items can be edited by the Implementation manager in each client's unique portal. 
**Interactive for:** All users (checkbox acknowledgment per item)

#### 5.1 Structure
- Items are organized into three labeled groups:
  1. **General Transition Expectations**
  2. **Member Transition Expectations**
  3. **Broker Expectations**
- Each group is expandable/collapsible.
- Each item displays as a **card** with:
  - Title (bold)
  - Descriptive body text
  - Acknowledgment checkbox
- When a user checks an item, it is marked with a green checkmark and the user's name and timestamp.
- A **progress indicator** at the top of each group shows how many items have been acknowledged (e.g., "3 of 9 items reviewed").

#### 5.2 Standard Items

**General Transition Expectations:**

1. **Final Rate Changes May Occur** — Final rates may change with a final enrollment census. Stoploss reserves the right to adjust rates if the enrollment changes by more than 10% from the sold quote to the final enrollment, or if significant new medical risk is present.

2. **AI-Based Underwriting Notice** — If applicable, AI-based underwriting will almost always change slightly with a final enrollment census. Talk to your implementation manager if you have any questions about these adjustments.

3. **Timelines Are Subject to Change** — Timelines are estimates and may be adjusted depending on when the previous item is received. Please note that any custom solutions will impact timelines.

4. **Audit Your First Invoice** — Please make sure to always check the first invoice for accuracy, both regarding plan rates and enrollment. Members not included on the final enrollment census will not be enrolled at the effective date. We recommend NOT downloading your final enrollment census from your payroll system, which frequently misses COBRA members.

5. **Alert Your Bank** — To avoid any delays with claims payment, please alert your bank that an ACH pull will be coming from our TPA.

6. **ID Cards** — Members will receive ID cards with ONLY the subscriber's information. All members will use the same ID card. We do this to improve billing accuracy.

7. **COBRA Members** - Please make sure you if you are pulling census data from your payroll system to include any active COBRA members. If census information omits COBRA members on the final census, COBRA members will NOT be eligible for coverage. 

**Member Transition Expectations:**

7. **Expect a Transition** — We are a unique solution in the market, so expect some disruption among members. This is normal, and our care coordination team will be very involved in solving any confusion or issues that members experience, especially in the first few months.

8. **Our "Guardrails"** — We purposefully put in place "Guardrails" in our plan to prevent you from unknowingly spending more money on medical services than you need. If you encounter an issue or a denial, it is likely due to one of these guardrails. You may receive a call from us offering alternative options to save you money.

9. **Member Support Channels** — Make sure members know they can reach out directly to Hello@39N.CO or the number on their ID card with any issues. They will speak with a live person.

10. **HR Cannot Assist with Medical Issues** — Let members know that reaching out to HR for issues is NOT recommended. HR will not likely be able to assist them with medical, billing, or other insurance issues.

11. **New Prior Authorizations** — As with any health plan transition, members will need to get updated Prior Authorizations. We will deny advanced medical and pharmacy services without one. Have members speak with their providers to see if one is required for their medical needs.

12. **Direct & Advanced Primary Care** — We include advanced primary care solutions on most plans. These are free and unlimited to members, and are subsidized by the plan. If applicable, please make sure members are aware of these amazing benefits.

13. **Review All Bills** — We recommend members take 30 seconds to review all bills and EOBs they receive. If services or payments look incorrect, or you have a question, please feel free to reach out to us.

14. **If a Provider Hasn't Heard of Us** — Please have your provider call the number on your ID card. We have several partnerships with other carriers to access networks, and not every provider has heard of us.

15. **If You Receive a Medical Denial** — The most common reason for medical denials is a lack of Prior Authorization. Please have your provider read the denial reason, and call us to get this fixed. More often than not, a denial is temporary.

16. **If You Receive a Pharmacy Denial** — Most Rx denials are due to medication triggering our "Rate Limit." We put this in place because many pharmacies charge 3–5x more than the medication's fair market value. Please have the pharmacist read the denial notice to you, and either call the number on the denial or the number on your ID card.

**Broker Expectations:**

17. **Commissions** — It is common for first commissions to be paid out 2–3 months after the effective date. Implementation delays may cause first commissions to be paid later.

18. **Aggregate Reports & Plan Data** — This information is provided online via our TPA portal. First data reports are usually produced about 3 months after the effective date due to claims lag. Subsequent reports will be produced about 3–4 weeks after the end of the plan month.

19. **Renewals** — We will frequently submit renewal rates more than 60 days before the renewal date. However, this may depend on plan performance and if our underwriting teams require additional experience to provide the most competitive rates. We will work with your team to produce renewals in a timely manner.

20. **Transparency Tools** — We have transparency tools available to clients for an additional fee. We will submit proper paperwork to government entities on your behalf, so you don't have to file this additional paperwork.

#### 5.3 Editability
- Implementation managers can **add, edit, or remove** any item.
- Items can be reordered via drag-and-drop.
- Edits apply only to the current client instance unless the manager updates the global template.
- An admin user will be able to adjust the Standard Items so that all new clients will show these when a client profile is created. 

---

### Section 6: Document Center

**Purpose:** Centralize all client and broker documents for easy access.  
**Managed by:** Implementation Manager  
**Visible to:** All users with access to this client instance

#### 6.1 Features
- **File upload** via drag-and-drop or file picker (PDF, DOCX, XLSX, PNG, JPG supported; max 50MB per file).
- Uploaded files are displayed in a list or grid with: file name, file type icon, upload date, uploaded by, and file size.
- **Download** button on each file.
- **Delete** button (Implementation Manager only); requires confirmation.
- Optional **folder/category** organization (e.g., "Contracts," "Enrollment," "Invoices," "Correspondence").
- Search bar to filter documents by name.
- Documents are stored securely with access limited to the client instance.

---

## 6. Global Admin Panel (Implementation Manager)

### 6.1 Client List View
- A dashboard showing all active client instances in a sortable table: Client Name, Effective Date, Implementation Stage, % Deliverables Complete, Last Activity.
- Search and filter by name, effective date, or stage.
- "New Client" button to create a new instance.
- A grid of client records where an admin user can set or change login credentials for the client. 

### 6.2 Global Template Editor
- A dedicated screen where implementation managers can edit the **standard workflow template** that is applied to all new client instances.
- Sections editable in the template: Deliverables list (Section 3), What to Expect items (Section 5), default Contact roles.
- Changes to the global template do **not** retroactively change existing client instances; a manager must manually apply changes.

### 6.3 Contact Library
- A searchable, global contact directory.
- Contacts can be created here directly or carry over from client instances.
- Each contact record shows which client instances they are associated with.

---

## 7. Technical Requirements

### 7.1 Platform
- **Web-based** (browser-first); responsive design supporting Chrome, Firefox, Safari, Edge.
- Mobile-responsive layout (tablet and phone).
- No native app required for initial prototype.

### 7.2 Data Storage
- All client instance data stored in a secure database (e.g., PostgreSQL or equivalent).
- Sensitive fields (banking information) encrypted at rest (AES-256) and in transit (TLS 1.2+).
- Document files stored in secure cloud object storage (e.g., AWS S3 or equivalent).

### 7.3 Spreadsheet Integration
- **Google Sheets:** OAuth 2.0 authentication; data written to a designated spreadsheet and sheet tab.
- **Microsoft Excel/OneDrive:** Microsoft Graph API; OAuth 2.0 authentication.
- Each client instance maps to one row (or one dedicated tab, configurable) in the spreadsheet.
- Sync fields: all Section 1 and Section 2 fields.
- Sync is triggered on every save action. Sync status and last-synced timestamp shown in the UI.

### 7.4 Authentication & Security
- Email + password authentication.
- Role-based access control (Implementation Manager, Client, Broker — see Section 3).
- Session management: 30-minute idle timeout (configurable per instance).
- Password policies: minimum 8 characters, one uppercase, one number.
- All data transmitted over HTTPS.

### 7.5 Audit Logging
- All changes to fields, deliverable status, and document uploads are logged with: user, timestamp, field changed, old value, new value.
- Logs are accessible to Implementation Managers.

---

## 8. UI/UX Requirements

- **Left sidebar navigation** with section labels; active section highlighted; collapsible on small screens.
- **Visual completion indicators** on deliverables: unchecked (default), checked (green background, checkmark icon, timestamp + user displayed below the item).
- **Alert badges** on deliverable items marked as blocking (🔴) or informational (⚠️).
- **Timeline visualization** in Section 3: a date-anchored bar or Gantt-style view showing all deliverables relative to the effective date.
- **Progress bars** in Section 5 groups showing acknowledgment completion.
- **Edit mode** for data sections: fields are read-only by default; an "Edit" button toggles them to editable; a "Save" button commits changes; "Cancel" reverts.
- **Responsive modal forms** for adding contacts and documents.
- Clean, professional aesthetic appropriate for health insurance and HR professionals. Trustworthy, organized, minimal visual noise.

---

## 9. Out of Scope (Version 1.0)

The following are noted for future versions and are **not** required in the initial prototype:

- Email notification system (automated reminders for upcoming deliverables)
- E-signature integration (DocuSign or equivalent)
- Two-factor authentication
- Direct TPA portal data integration
- Claims reporting or data analytics dashboards
- Client-facing self-service account creation

---

## 10. Open Questions for Development Team

1. Will this be built as a single-page application (React, Vue) or a server-rendered app? This impacts how sidebar navigation and state management are implemented. Response: single-page application in React is preferred. 
2. What cloud infrastructure is preferred for document storage and database hosting? Response: AWS is prefered. 
3. Is Google Sheets *or* Microsoft Excel the target integration, or should both be supported at launch? Response: Microsoft Excel is the target integration at launch. 
4. Should completion timestamps in the deliverables checklist be editable (e.g., for backdating), or locked once set? Response: These should be editable. 
5. Should brokers and clients share a single login or have separate credential sets per instance? Response: They have have a shared login. 
---

*End of Document*
