import swaggerJSDoc from 'swagger-jsdoc';

export function buildSwaggerSpec() {
  return swaggerJSDoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'SlackTrack Server API',
        version: '0.1.0',
        description: 'Admin and Slack ingestion APIs for SlackTrack'
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'Token'
          }
        },
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              slackUserId: { type: 'string', example: 'U0A5YQ63CMT' },
              displayName: { type: 'string', nullable: true, example: 'Rahul Anand' },
              email: { type: 'string', nullable: true, example: 'rahul@example.com' },
              isMessageEnabled: { type: 'boolean', example: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            },
            required: ['id', 'slackUserId', 'displayName', 'email', 'isMessageEnabled', 'createdAt', 'updatedAt']
          },
          Timer: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              name: { type: 'string', example: 'Morning Reminder' },
              timerType: { type: 'string', enum: ['morning', 'evening', 'custom'], example: 'custom' },
              cronExpression: { type: 'string', example: '0 9 * * *' },
              timezone: { type: 'string', example: 'Asia/Kolkata' },
              active: { type: 'boolean', example: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            },
            required: [
              'id',
              'name',
              'timerType',
              'cronExpression',
              'timezone',
              'active',
              'createdAt',
              'updatedAt'
            ]
          },
          ProjectCatalog: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              name: { type: 'string', example: 'SlackTrack' },
              active: { type: 'boolean', example: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            },
            required: ['id', 'name', 'active', 'createdAt', 'updatedAt']
          },
          AdminAuthUser: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              email: { type: 'string', example: 'hr@company.com' },
              role: { type: 'string', enum: ['admin', 'hr', 'manager'], example: 'hr' },
              permissions: {
                type: 'array',
                items: { type: 'string' },
                example: ['users:read', 'users:write', 'overrides:write']
              }
            },
            required: ['id', 'email', 'role', 'permissions']
          },
          AuthSessionResponse: {
            type: 'object',
            properties: {
              accessToken: { type: 'string', example: '25b89f5a7a2e...' },
              expiresAt: { type: 'string', format: 'date-time' },
              user: { $ref: '#/components/schemas/AdminAuthUser' }
            },
            required: ['accessToken', 'expiresAt', 'user']
          },
          AdminUserCreateResponse: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 2 },
              email: { type: 'string', example: 'manager@company.com' },
              role: { type: 'string', enum: ['admin', 'hr', 'manager'], example: 'manager' },
              active: { type: 'boolean', example: true }
            },
            required: ['id', 'email', 'role', 'active']
          }
        }
      },
      paths: {
        '/api/health': {
          get: {
            summary: 'Health check',
            responses: {
              '200': {
                description: 'Service is healthy',
                content: {
                  'application/json': {
                    example: { ok: true, timestamp: '2026-03-28T10:10:10.000Z' }
                  }
                }
              }
            }
          }
        },
        '/api/slack/events': {
          post: {
            summary: 'Slack Events + Interactive callback endpoint',
            description: 'Protected by Slack signature validation. Not for general API clients.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    type: 'event_callback',
                    team_id: 'T670G9SQ6',
                    event: {
                      type: 'message',
                      channel_type: 'im',
                      user: 'U0A5YQ63CMT',
                      channel: 'D12345678',
                      text: 'wfh',
                      ts: '1711618775.000100'
                    }
                  }
                },
                'application/x-www-form-urlencoded': {
                  example: {
                    payload:
                      '{"type":"block_actions","user":{"id":"U0A5YQ63CMT"},"actions":[{"action_id":"wfo"}],"action_ts":"1711618775.000100"}'
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Accepted' },
              '401': { description: 'Invalid signature' }
            }
          }
        },
        '/api/admin/auth/login': {
          post: {
            summary: 'Admin login (email + password)',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    email: 'hr@company.com',
                    password: 'StrongPassword123'
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Login successful',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/AuthSessionResponse' }
                      }
                    }
                  }
                }
              },
              '401': {
                description: 'Invalid credentials',
                content: {
                  'application/json': {
                    example: { ok: false, error: 'Invalid email or password' }
                  }
                }
              }
            }
          }
        },
        '/api/admin/auth/admin-users': {
          post: {
            summary: 'Create admin/HR/manager user (admin only)',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    email: 'manager@company.com',
                    password: 'StrongPassword123',
                    role: 'manager'
                  }
                }
              }
            },
            responses: {
              '201': {
                description: 'Admin user created or updated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/AdminUserCreateResponse' }
                      }
                    }
                  }
                }
              },
              '403': {
                description: 'Permission denied',
                content: {
                  'application/json': {
                    example: { ok: false, error: 'Permission denied for admin:write' }
                  }
                }
              }
            }
          }
        },
        '/api/admin/auth/logout': {
          post: {
            summary: 'Admin logout',
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Logout successful',
                content: {
                  'application/json': {
                    example: { ok: true }
                  }
                }
              }
            }
          }
        },
        '/api/admin/auth/me': {
          get: {
            summary: 'Get current admin profile',
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Current admin profile',
                content: {
                  'application/json': {
                    example: {
                      ok: true,
                      data: {
                        actorId: '1',
                        email: 'hr@company.com',
                        role: 'hr',
                        permissions: ['users:read', 'users:write', 'overrides:write']
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/admin/projects': {
          get: {
            summary: 'List project catalog items',
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Project list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { type: 'array', items: { $ref: '#/components/schemas/ProjectCatalog' } }
                      }
                    }
                  }
                }
              }
            }
          },
          post: {
            summary: 'Create or upsert project catalog item',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    name: 'SlackTrack',
                    active: true
                  }
                }
              }
            },
            responses: {
              '201': {
                description: 'Project created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/ProjectCatalog' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/admin/projects/{id}': {
          patch: {
            summary: 'Update project catalog item',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' }
              }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    name: 'Internal Tooling',
                    active: false
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Project updated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/ProjectCatalog' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/admin/timers': {
          get: {
            summary: 'List reminder timers',
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Timer list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { type: 'array', items: { $ref: '#/components/schemas/Timer' } }
                      }
                    }
                  }
                }
              }
            }
          },
          post: {
            summary: 'Create reminder timer',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    name: 'Test Reminder',
                    timerType: 'custom',
                    cronExpression: '*/5 * * * *',
                    timezone: 'Asia/Kolkata',
                    active: true
                  }
                }
              }
            },
            responses: {
              '201': {
                description: 'Timer created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/Timer' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/admin/timers/{id}': {
          patch: {
            summary: 'Update reminder timer',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' }
              }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    name: 'Evening Reminder',
                    cronExpression: '0 18 * * *',
                    active: true
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Timer updated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/Timer' }
                      }
                    }
                  }
                }
              }
            }
          },
          delete: {
            summary: 'Delete reminder timer',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' }
              }
            ],
            responses: {
              '200': {
                description: 'Timer deleted',
                content: {
                  'application/json': {
                    example: { ok: true }
                  }
                }
              }
            }
          }
        },
        '/api/admin/overrides/attendance': {
          post: {
            summary: 'Manual attendance override',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    slackUserId: 'U0A5YQ63CMT',
                    dateYmd: '2026-03-28',
                    status: 'WFH'
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Override applied',
                content: {
                  'application/json': {
                    example: { ok: true }
                  }
                }
              }
            }
          }
        },
        '/api/admin/overrides/projects': {
          post: {
            summary: 'Manual project override',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    slackUserId: 'U0A5YQ63CMT',
                    dateYmd: '2026-03-28',
                    projects: ['SlackTrack', 'Internal Tooling']
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Override applied',
                content: {
                  'application/json': {
                    example: { ok: true }
                  }
                }
              }
            }
          }
        },
        '/api/admin/users': {
          get: {
            summary: 'List users for reminder management',
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Users list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { type: 'array', items: { $ref: '#/components/schemas/User' } }
                      }
                    }
                  }
                }
              }
            }
          },
          post: {
            summary: 'Add or update user profile for reminders',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  example: {
                    name: 'Rahul Anand',
                    slackId: 'U0A5YQ63CMT',
                    email: 'rahul@example.com',
                    isMessageEnabled: true
                  }
                }
              }
            },
            responses: {
              '201': {
                description: 'User upserted',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/admin/users/{slackUserId}/messaging/deactivate': {
          patch: {
            summary: 'Deactivate reminder messaging for a user',
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'slackUserId',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              }
            ],
            responses: {
              '200': {
                description: 'Messaging deactivated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        ok: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/admin/sync/reconcile': {
          post: {
            summary: 'Trigger manual DB->Sheet reconcile',
            security: [{ bearerAuth: [] }],
            responses: {
              '202': {
                description: 'Reconcile queued',
                content: {
                  'application/json': {
                    example: { ok: true, message: 'Reconcile job queued' }
                  }
                }
              }
            }
          }
        }
      }
    },
    apis: []
  });
}
