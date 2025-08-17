'use strict'

const events = [
  {
    specversion: '1.0',
    type: 'com.alyne.users.loggedIn',
    source: 'auth-service',
    id: 'user-login-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '5ea2bd93f4b8505567662936',
        email: 'user1@test.com',
        userType: 'Admin',
        lastLogin: new Date().toISOString(),
        org: '5b224b4b01e6a32ae17a7134'
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.objects.created',
    source: 'object-service',
    id: 'obj-create-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '5a79357fa01b451f003fc37f',
        itemId: 150,
        typeName: 'alyne|information_asset',
        org: '5b224b4b01e6a32ae17a7134',
        lifecycleStatus: 'published',
        object: {
          title: 'Test Asset',
          personalInformation: 'yes',
          access: { en_GB: 'PROTECTED' }
        }
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.objects.updated',
    source: 'object-service',
    id: 'obj-update-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '5a79357fa01b451f003fc37f',
        itemId: 75,
        typeName: 'alyne|control',
        org: '5b224b4b01e6a32ae17a7134',
        lifecycleStatus: 'published',
        priority: 'medium'
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.questionnaireresponse.reviewed',
    source: 'assessment-service',
    id: 'qr-review-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '64b946edf26a6b001a8d7e26',
        org: '5b224b4b01e6a32ae17a7134',
        state: 'IN_REVIEW',
        review: {
          state: 'APPROVED',
          maturityValue: 2,
          maturityLevel: 2
        }
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.tasks.updated',
    source: 'task-service',
    id: 'task-update-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '66056a0ffaf812611a2fe3c7',
        org: '5b224b4b01e6a32ae17a7134',
        title: 'Security Review Task',
        status: 'open',
        itemId: 418,
        relatedRecords: ['mitigation:123', 'issue:456']
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.assessments.completed',
    source: 'assessment-service',
    id: 'assessment-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '64c123456789abcdef123456',
        org: '5b224b4b01e6a32ae17a7134',
        score: 4.5,
        completionStatus: 'complete'
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.risks.created',
    source: 'risk-service',
    id: 'risk-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '64d789012345678901234567',
        org: '5b224b4b01e6a32ae17a7134',
        riskScore: 8.5,
        severity: 'critical'
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.controls.evaluated',
    source: 'control-service',
    id: 'control-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '64e890123456789012345678',
        org: '5b224b4b01e6a32ae17a7134',
        maturityLevel: 1,
        confidenceScore: 95
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.documents.uploaded',
    source: 'document-service',
    id: 'doc-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '64f901234567890123456789',
        org: '5b224b4b01e6a32ae17a7134',
        fileSize: 15728640,
        eventType: 'upload'
      }
    }
  },
  {
    specversion: '1.0',
    type: 'com.alyne.mitigations.assigned',
    source: 'mitigation-service',
    id: 'mitigation-001',
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      record: {
        _id: '650123456789012345678901',
        org: '5b224b4b01e6a32ae17a7134',
        priority: 'high',
        completionPercentage: 75
      }
    }
  }
]

function generateVariations (baseEvents, count = 1000) {
  const variations = []

  for (let i = 0; i < count; i++) {
    const baseEvent = baseEvents[i % baseEvents.length]
    const variation = JSON.parse(JSON.stringify(baseEvent))

    variation.id = `${baseEvent.id}-${i}`
    variation.time = new Date(Date.now() + i * 1000).toISOString()

    if (variation.data.record.itemId) {
      variation.data.record.itemId = Math.floor(Math.random() * 1000) + 1
    }
    if (variation.data.record.score) {
      variation.data.record.score = Math.random() * 5
    }
    if (variation.data.record.riskScore) {
      variation.data.record.riskScore = Math.random() * 10
    }
    if (variation.data.record.maturityLevel) {
      variation.data.record.maturityLevel = Math.floor(Math.random() * 5) + 1
    }
    if (variation.data.record.completionPercentage) {
      variation.data.record.completionPercentage = Math.floor(Math.random() * 100)
    }
    if (variation.data.record.confidenceScore) {
      variation.data.record.confidenceScore = Math.floor(Math.random() * 100)
    }
    if (variation.data.record.fileSize) {
      variation.data.record.fileSize = Math.floor(Math.random() * 50000000)
    }

    variations.push(variation)
  }

  return variations
}

module.exports = {
  baseEvents: events,
  generateEvents: generateVariations
}
