'use strict'

module.exports = [
  {
    _id: 'rule-001',
    conditions: {
      any: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.users.loggedIn',
          path: '$'
        },
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.users.loggedOut',
          path: '$'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'test-bucket-1',
        region: 'us-east-1',
        format: 'json'
      }
    }
  },
  {
    _id: 'rule-002',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.objects.created',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'published',
          path: '$.record.lifecycleStatus'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/test-001'
      }
    }
  },
  {
    _id: 'rule-003',
    conditions: {
      any: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.objects.updated',
          path: '$'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'test-bucket-2',
        region: 'us-west-2',
        format: 'json'
      }
    }
  },
  {
    _id: 'rule-004',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.questionnaireresponse.reviewed',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'lessThan',
          value: 3,
          path: '$.record.review.maturityValue'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/test-002'
      }
    }
  },
  {
    _id: 'rule-005',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.tasks.updated',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'open',
          path: '$.record.status'
        }
      ]
    },
    event: {
      type: 'sendEmail',
      params: {
        recipients: ['admin@test.com']
      }
    }
  },
  {
    _id: 'rule-006',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'greaterThan',
          value: 100,
          path: '$.record.itemId'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'critical',
          path: '$.record.priority'
        }
      ]
    },
    event: {
      type: 'internalLambda',
      params: {
        lambdaName: 'test-lambda-001'
      }
    }
  },
  {
    _id: 'rule-007',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.assessments.completed',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'greaterThanInclusive',
          value: 4,
          path: '$.record.score'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/test-003'
      }
    }
  },
  {
    _id: 'rule-008',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'Admin',
          path: '$.record.userType'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'Expert',
          path: '$.record.userType'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'admin-bucket',
        region: 'eu-west-1',
        format: 'json'
      }
    }
  },
  {
    _id: 'rule-009',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.risks.created',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'greaterThan',
          value: 7,
          path: '$.record.riskScore'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/high-risk'
      }
    }
  },
  {
    _id: 'rule-010',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'PROTECTED',
          path: '$.record.object.access.en_GB'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'CONFIDENTIAL',
          path: '$.record.object.access.en_GB'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'secure-bucket',
        region: 'us-east-1',
        format: 'encrypted'
      }
    }
  },
  {
    _id: 'rule-011',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.controls.evaluated',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'lessThanInclusive',
          value: 2,
          path: '$.record.maturityLevel'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/low-maturity'
      }
    }
  },
  {
    _id: 'rule-012',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'yes',
          path: '$.record.object.personalInformation'
        }
      ]
    },
    event: {
      type: 'internalLambda',
      params: {
        lambdaName: 'privacy-handler'
      }
    }
  },
  {
    _id: 'rule-013',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.documents.uploaded',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'greaterThan',
          value: 10485760,
          path: '$.record.fileSize'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'large-files-bucket',
        region: 'us-west-1',
        format: 'compressed'
      }
    }
  },
  {
    _id: 'rule-014',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'APPROVED',
          path: '$.record.review.state'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'REJECTED',
          path: '$.record.review.state'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/review-complete'
      }
    }
  },
  {
    _id: 'rule-015',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.mitigations.assigned',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'high',
          path: '$.record.priority'
        }
      ]
    },
    event: {
      type: 'sendEmail',
      params: {
        recipients: ['manager@test.com', 'team@test.com']
      }
    }
  },
  {
    _id: 'rule-016',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'greaterThanInclusive',
          value: 50,
          path: '$.record.completionPercentage'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/progress-update'
      }
    }
  },
  {
    _id: 'rule-017',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.frameworks.applied',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'ISO27001',
          path: '$.record.frameworkType'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'compliance-bucket',
        region: 'eu-central-1',
        format: 'json'
      }
    }
  },
  {
    _id: 'rule-018',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'urgent',
          path: '$.record.severity'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'critical',
          path: '$.record.severity'
        }
      ]
    },
    event: {
      type: 'internalLambda',
      params: {
        lambdaName: 'urgent-response-handler'
      }
    }
  },
  {
    _id: 'rule-019',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.vendors.onboarded',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'active',
          path: '$.record.status'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/vendor-active'
      }
    }
  },
  {
    _id: 'rule-020',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'greaterThan',
          value: 1000000,
          path: '$.record.contractValue'
        }
      ]
    },
    event: {
      type: 'sendEmail',
      params: {
        recipients: ['legal@test.com', 'finance@test.com']
      }
    }
  },
  {
    _id: 'rule-021',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.audits.scheduled',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'external',
          path: '$.record.auditType'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'audit-bucket',
        region: 'ap-southeast-1',
        format: 'json'
      }
    }
  },
  {
    _id: 'rule-022',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'overdue',
          path: '$.record.status'
        },
        {
          fact: 'data',
          operator: 'lessThan',
          value: Date.now(),
          path: '$.record.dueDate'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/overdue-items'
      }
    }
  },
  {
    _id: 'rule-023',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.incidents.reported',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'greaterThanInclusive',
          value: 8,
          path: '$.record.severityScore'
        }
      ]
    },
    event: {
      type: 'internalLambda',
      params: {
        lambdaName: 'incident-escalation'
      }
    }
  },
  {
    _id: 'rule-024',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'GDPR',
          path: '$.record.regulationType'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'CCPA',
          path: '$.record.regulationType'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'privacy-compliance',
        region: 'eu-west-1',
        format: 'encrypted'
      }
    }
  },
  {
    _id: 'rule-025',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.assessments.submitted',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'complete',
          path: '$.record.completionStatus'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/assessment-complete'
      }
    }
  },
  {
    _id: 'rule-026',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'breach',
          path: '$.record.eventType'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'violation',
          path: '$.record.eventType'
        }
      ]
    },
    event: {
      type: 'internalLambda',
      params: {
        lambdaName: 'security-incident-handler'
      }
    }
  },
  {
    _id: 'rule-027',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.policies.updated',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'equal',
          value: 'published',
          path: '$.record.status'
        }
      ]
    },
    event: {
      type: 'sendEmail',
      params: {
        recipients: ['policy-team@test.com']
      }
    }
  },
  {
    _id: 'rule-028',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'greaterThan',
          value: 90,
          path: '$.record.confidenceScore'
        }
      ]
    },
    event: {
      type: 'putS3',
      params: {
        bucket: 'high-confidence',
        region: 'ca-central-1',
        format: 'json'
      }
    }
  },
  {
    _id: 'rule-029',
    conditions: {
      all: [
        {
          fact: 'type',
          operator: 'equal',
          value: 'com.alyne.trainings.completed',
          path: '$'
        },
        {
          fact: 'data',
          operator: 'greaterThanInclusive',
          value: 85,
          path: '$.record.scorePercentage'
        }
      ]
    },
    event: {
      type: 'webhook',
      params: {
        url: 'https://webhook.site/training-passed'
      }
    }
  },
  {
    _id: 'rule-030',
    conditions: {
      any: [
        {
          fact: 'data',
          operator: 'equal',
          value: 'expired',
          path: '$.record.certificateStatus'
        },
        {
          fact: 'data',
          operator: 'lessThan',
          value: Date.now() + (30 * 24 * 60 * 60 * 1000),
          path: '$.record.expirationDate'
        }
      ]
    },
    event: {
      type: 'sendEmail',
      params: {
        recipients: ['compliance@test.com']
      }
    }
  }
]
