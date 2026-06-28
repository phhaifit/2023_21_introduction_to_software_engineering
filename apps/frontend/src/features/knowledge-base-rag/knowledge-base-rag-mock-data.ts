import type {
  ExternalDataSource,
  KnowledgeDocument,
  ProcessingJob,
  SyncJob,
  SyncScopeNode,
  UploadCandidateFile
} from "./knowledge-base-rag-view.ts";

export const mockKnowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "doc-employee-handbook-2026",
    name: "Employee Handbook 2026.pdf",
    source: "upload",
    type: "pdf",
    sizeLabel: "4.8 MB",
    owner: "People Operations",
    updatedAt: "2026-06-18 09:20",
    status: "ready",
    chunkCount: 142,
    summary: "Company policies, benefits, conduct guidelines, and employee support resources."
  },
  {
    id: "doc-remote-work-policy",
    name: "Remote Work Policy.docx",
    source: "upload",
    type: "docx",
    sizeLabel: "1.2 MB",
    owner: "People Operations",
    updatedAt: "2026-06-19 14:45",
    status: "processing",
    chunkCount: 38,
    summary: "Remote work eligibility, collaboration expectations, and equipment guidance."
  },
  {
    id: "doc-product-faq",
    name: "Product FAQ.txt",
    source: "upload",
    type: "txt",
    sizeLabel: "256 KB",
    owner: "Product",
    updatedAt: "2026-06-16 11:10",
    status: "ready",
    chunkCount: 64,
    summary: "Common product questions, usage notes, billing answers, and support responses."
  },
  {
    id: "doc-engineering-onboarding-guide",
    name: "Engineering Onboarding Guide",
    source: "notion",
    type: "page",
    sizeLabel: "18 pages",
    owner: "Engineering",
    updatedAt: "2026-06-20 10:30",
    status: "pending",
    indexedItemCount: 0,
    description: "Setup checklist, coding standards, release flow, and team operating practices."
  },
  {
    id: "doc-customer-support-playbook",
    name: "Customer Support Playbook",
    source: "confluence",
    type: "page",
    sizeLabel: "24 pages",
    owner: "Support",
    updatedAt: "2026-06-17 16:05",
    status: "failed",
    indexedItemCount: 12,
    description: "Escalation paths, response templates, account triage, and service recovery notes."
  },
  {
    id: "doc-security-review-checklist",
    name: "Security Review Checklist.pdf",
    source: "google-drive",
    type: "pdf",
    sizeLabel: "2.6 MB",
    owner: "Security",
    updatedAt: "2026-06-21 08:55",
    status: "ready",
    chunkCount: 87,
    summary: "Security review criteria for new services, integrations, vendors, and releases."
  }
];

export const mockUploadCandidateFiles: UploadCandidateFile[] = [
  {
    id: "upload-benefits-overview",
    name: "Benefits Overview.pdf",
    type: "pdf",
    sizeLabel: "3.1 MB",
    validationStatus: "valid",
    validationMessage: "Ready to upload."
  },
  {
    id: "upload-sales-enablement",
    name: "Sales Enablement Guide.docx",
    type: "docx",
    sizeLabel: "2.4 MB",
    validationStatus: "valid",
    validationMessage: "Ready to upload."
  },
  {
    id: "upload-release-notes",
    name: "Release Notes.txt",
    type: "txt",
    sizeLabel: "420 KB",
    validationStatus: "valid",
    validationMessage: "Ready to upload."
  },
  {
    id: "upload-roadmap-deck",
    name: "Product Roadmap Deck.pptx",
    type: "pptx",
    sizeLabel: "8.6 MB",
    validationStatus: "invalid",
    validationMessage: "Unsupported file type. Use PDF, DOCX, TXT, CSV, or page content."
  },
  {
    id: "upload-finance-export",
    name: "Annual Finance Export.csv",
    type: "csv",
    sizeLabel: "128 MB",
    validationStatus: "invalid",
    validationMessage: "File exceeds the 100 MB upload limit."
  }
];

export const mockProcessingJobs: ProcessingJob[] = [
  {
    jobId: "processing-employee-handbook-2026",
    documentName: "Employee Handbook 2026.pdf",
    fileType: "pdf",
    sourceName: "Upload",
    status: "completed",
    progress: 100,
    currentStep: "Ready for retrieval",
    startedAt: "2026-06-18 09:22",
    completedAt: "2026-06-18 09:29"
  },
  {
    jobId: "processing-remote-work-policy",
    documentName: "Remote Work Policy.docx",
    fileType: "docx",
    sourceName: "Upload",
    status: "processing",
    progress: 62,
    currentStep: "Indexing content",
    startedAt: "2026-06-19 14:46"
  },
  {
    jobId: "processing-engineering-onboarding-guide",
    documentName: "Engineering Onboarding Guide",
    fileType: "page",
    sourceName: "Notion",
    status: "queued",
    progress: 0,
    currentStep: "Queued for processing",
    startedAt: "2026-06-20 10:31"
  },
  {
    jobId: "processing-customer-support-playbook",
    documentName: "Customer Support Playbook",
    fileType: "page",
    sourceName: "Confluence",
    status: "failed",
    progress: 48,
    currentStep: "Parsing page content",
    startedAt: "2026-06-17 16:06",
    failedAt: "2026-06-17 16:09",
    safeErrorMessage:
      "Some selected content could not be read. Review source access and retry the job."
  }
];

export const mockIngestionJobs = mockProcessingJobs;

export const mockExternalDataSources: ExternalDataSource[] = [
  {
    id: "source-google-drive",
    provider: "google-drive",
    name: "Google Drive",
    status: "syncing",
    description: "Shared drives for policy documents, security reviews, and product files.",
    lastSyncAt: "2026-06-21 08:40",
    nextSyncAt: "2026-06-21 12:40",
    selectedScopeCount: 6,
    syncSummary: "Refreshing selected folders and recently changed files."
  },
  {
    id: "source-notion",
    provider: "notion",
    name: "Notion",
    status: "connected",
    description: "Team pages for onboarding, product planning, and operating rituals.",
    lastSyncAt: "2026-06-20 18:15",
    nextSyncAt: "2026-06-22 09:00",
    selectedScopeCount: 4,
    syncSummary: "All selected pages are up to date."
  },
  {
    id: "source-confluence",
    provider: "confluence",
    name: "Confluence",
    status: "failed",
    description: "Support and engineering spaces for customer operations and runbooks.",
    lastSyncAt: "2026-06-17 16:10",
    selectedScopeCount: 3,
    syncSummary: "Last sync stopped because one selected space needs permission review."
  }
];

export const mockSyncScopeTree: SyncScopeNode[] = [
  {
    id: "scope-company-handbook",
    name: "Company Handbook",
    type: "folder",
    selected: true,
    children: [
      {
        id: "scope-company-handbook-employee-basics",
        name: "Employee Basics.pdf",
        type: "file",
        selected: true
      },
      {
        id: "scope-company-handbook-benefits",
        name: "Benefits Overview.pdf",
        type: "file",
        selected: true
      }
    ]
  },
  {
    id: "scope-hr-policies",
    name: "HR Policies",
    type: "folder",
    selected: true,
    children: [
      {
        id: "scope-hr-policies-remote-work",
        name: "Remote Work Policy.docx",
        type: "file",
        selected: true
      },
      {
        id: "scope-hr-policies-leave-policy",
        name: "Leave Policy.pdf",
        type: "file",
        selected: false
      }
    ]
  },
  {
    id: "scope-product-documentation",
    name: "Product Documentation",
    type: "space",
    selected: true,
    children: [
      {
        id: "scope-product-documentation-faq",
        name: "Product FAQ",
        type: "page",
        selected: true
      },
      {
        id: "scope-product-documentation-release-notes",
        name: "Release Notes",
        type: "page",
        selected: true
      }
    ]
  },
  {
    id: "scope-meeting-notes",
    name: "Meeting Notes",
    type: "folder",
    selected: false,
    children: [
      {
        id: "scope-meeting-notes-leadership",
        name: "Leadership Weekly",
        type: "page",
        selected: false
      }
    ]
  },
  {
    id: "scope-engineering-wiki",
    name: "Engineering Wiki",
    type: "space",
    selected: true,
    children: [
      {
        id: "scope-engineering-wiki-onboarding",
        name: "Engineering Onboarding Guide",
        type: "page",
        selected: true
      },
      {
        id: "scope-engineering-wiki-runbooks",
        name: "Production Runbooks",
        type: "folder",
        selected: false,
        children: [
          {
            id: "scope-engineering-wiki-incident-response",
            name: "Incident Response Checklist",
            type: "page",
            selected: false
          }
        ]
      }
    ]
  }
];

export const mockSyncJobs: SyncJob[] = [
  {
    id: "sync-google-drive-current",
    sourceName: "Google Drive",
    status: "running",
    progress: 74,
    documentsAdded: 3,
    documentsUpdated: 8,
    documentsRemoved: 0,
    startedAt: "2026-06-21 08:40",
    message: "Scanning selected folders and updating changed files."
  },
  {
    id: "sync-notion-daily",
    sourceName: "Notion",
    status: "completed",
    progress: 100,
    documentsAdded: 1,
    documentsUpdated: 5,
    documentsRemoved: 0,
    startedAt: "2026-06-20 18:15",
    finishedAt: "2026-06-20 18:18",
    message: "Selected pages synchronized successfully."
  },
  {
    id: "sync-confluence-support",
    sourceName: "Confluence",
    status: "failed",
    progress: 36,
    documentsAdded: 0,
    documentsUpdated: 2,
    documentsRemoved: 0,
    startedAt: "2026-06-17 16:04",
    finishedAt: "2026-06-17 16:10",
    message: "Sync stopped because one selected space could not be accessed."
  },
  {
    id: "sync-google-drive-security",
    sourceName: "Google Drive",
    status: "completed",
    progress: 100,
    documentsAdded: 2,
    documentsUpdated: 4,
    documentsRemoved: 1,
    startedAt: "2026-06-19 07:30",
    finishedAt: "2026-06-19 07:34",
    message: "Security review documents synchronized successfully."
  }
];
