export default defineEventHandler(async (event) => {
  // Fetch the original OpenAPI spec
  const baseUrl = getRequestURL(event).origin
  const response = await $fetch<Record<string, unknown>>(`${baseUrl}/_openapi.json`)
  
  // Filter paths to only include /api/v1/** routes
  const filteredPaths: Record<string, unknown> = {}
  const paths = response.paths as Record<string, unknown> || {}
  
  for (const [path, methods] of Object.entries(paths)) {
    if (path.startsWith('/api/v1/')) {
      filteredPaths[path] = methods
    }
  }

  // Filter tags to only include relevant ones
  const relevantTags = new Set<string>()
  for (const methods of Object.values(filteredPaths)) {
    for (const method of Object.values(methods as Record<string, unknown>)) {
      const tags = (method as Record<string, unknown>)?.tags as string[] || []
      tags.forEach(tag => relevantTags.add(tag))
    }
  }

  // Build filtered spec with comprehensive authorization documentation
  const filteredSpec = {
    ...response,
    info: {
      title: 'Junglefy API',
      description: `# Junglefy API

API-first headless e-commerce platform for plants and flowers.

## Authorization

Junglefy uses two authentication methods depending on the use case:

### 1. JWT Authentication (Bearer Token)

Used for **user-based operations** like managing API keys, user settings, and administrative tasks.

**How to authenticate:**
1. Login via Supabase Auth to obtain a JWT token
2. Include the token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

**Use cases:**
- Creating, updating, and deleting API keys
- Managing organization settings
- User profile management

---

### 2. API Key Authentication

Used for **headless/external integrations** like storefronts, POS systems, and mobile apps.

**How to authenticate:**
Include your API key in the \`X-API-Key\` header:

\`\`\`
X-API-Key: jfy_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

**Key format:** \`jfy_live_\` followed by 32 alphanumeric characters.

**Important:**
- API keys are organization-scoped and can only access data within their organization
- Keys can have granular permissions (e.g., \`read:products\`, \`write:orders\`)
- Keys can be restricted to specific IP addresses
- Keys can have expiration dates (30 days, 90 days, 1 year, or unlimited)

---

## Permissions

API keys can have the following permissions:

| Permission | Description |
|------------|-------------|
| \`full_access\` | Full access to all resources |
| \`read:products\` | Read product data |
| \`write:products\` | Create, update, delete products |
| \`read:categories\` | Read category data |
| \`write:categories\` | Create, update, delete categories |
| \`read:orders\` | Read order data |
| \`write:orders\` | Create, update orders |
| \`read:customers\` | Read customer data |
| \`write:customers\` | Create, update customers |
| \`read:inventory\` | Read inventory data |
| \`write:inventory\` | Update inventory |
| \`read:users\` | Read organization members |
| \`write:users\` | Create, update, invite users |

---

## Rate Limits

Currently, there are no rate limits enforced. This may change in future versions.

---

## Errors

All errors follow a consistent format:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key"
  }
}
\`\`\`

Common error codes:
- \`401 Unauthorized\` - Missing or invalid authentication
- \`403 Forbidden\` - Valid auth but insufficient permissions
- \`404 Not Found\` - Resource not found
- \`400 Bad Request\` - Invalid request body or parameters
`,
      version: '1.0.0',
      contact: {
        name: 'Junglefy Support',
      },
    },
    paths: filteredPaths,
    tags: [
      { 
        name: 'API Keys', 
        description: `Manage API keys for your organization.

**Authentication required:** JWT (Bearer Token)

API keys allow external applications to access your organization's data. Each key can have:
- Granular permissions
- IP whitelist restrictions
- Expiration dates
- Location restrictions

**Note:** The actual API key is only shown once when created. Store it securely!`
      },
      {
        name: 'Users',
        description: `Manage organization members.

**Authentication required:** API Key with \`read:users\` or \`write:users\` permission

**Available operations:**
- List all organization members
- Get user details
- Create new users (with optional email invitation)
- Update user role and profile
- Remove users from organization

**User roles:**
- \`organization_owner\` - Full access (cannot be assigned via API)
- \`location_owner\` - Manage specific locations
- \`location_member\` - Access to assigned location
- \`customer\` - Customer account`
      },
      {
        name: 'Products',
        description: `Tenant-scoped sellable products.

**Authentication required:** JWT (Bearer Token) or API Key with \`read:products\` / \`write:products\` permission

Products represent the commercial items sold by each organization. They can optionally reference a global plant catalog entry (via \`plant_catalog_id\`) to inherit botanical data. Product availability and stock levels are managed separately via the Inventory endpoints.`
      },
      {
        name: 'Plant Catalog',
        description: `Global plant reference catalog shared across all tenants.

**Read access:** JWT (Bearer Token) or API Key
**Write access:** JWT (Bearer Token) only — organization owners

Contains botanical data, care instructions, and plant characteristics. Multiple organizations can reference the same catalog entry, avoiding duplicate data. Write operations use \`service_role\` internally to bypass tenant-scoped RLS.`
      },
      {
        name: 'Inventory',
        description: `Stock levels and product availability per organization and location.

**Authentication required:** JWT (Bearer Token) or API Key with \`read:inventory\` / \`write:inventory\` permission

Tracks physical stock, reserved quantities, and backorder settings. The available quantity is computed as \`quantity - reserved_quantity\`.

**Key concepts:**
- Inventory is always scoped to an organization
- Optional location scoping for multi-location setups
- Reserved quantities allow shopping carts and pending orders without reducing physical stock
- Backorders can be enabled per inventory record`
      },
      {
        name: 'Analytics',
        description: `Aggregated analytics and business intelligence data.

**Authentication required:** JWT (Bearer Token) or API Key

Provides organization-scoped analytics endpoints for reporting and data-driven decisions. No personal user data is exposed — only aggregated metrics.`
      },
      {
        name: 'Favorites',
        description: `## Product Favorites Management

Complete REST API for managing customer product favorites with role-based access control and analytics capabilities.

### Authentication
**Required:** JWT Bearer Token or API Key (endpoint-specific)

#### User Favorites Management
- **Authentication:** JWT Bearer Token only
- **Use Case:** Customer self-service and admin user management

#### Analytics & Business Intelligence  
- **Authentication:** JWT Bearer Token OR API Key
- **JWT Requirements:** Organization Owner or Location Owner
- **API Key Requirements:** \`read:users\` or \`full_access\` permission
- **Use Case:** Business analytics and reporting

### API Endpoints

#### User Favorites Management (JWT Only)
- **GET** \`/api/v1/users/{userId}/favorites\` - Retrieve user's favorite products
- **POST** \`/api/v1/users/{userId}/favorites\` - Add favorites  
- **DELETE** \`/api/v1/users/{userId}/favorites/{favoriteId}\` - Remove specific favorite

#### Analytics & Business Intelligence (JWT or API Key)
- **GET** \`/api/v1/analytics/favorites\` - Get favorites analytics

### Access Control Matrix
| Role | Own Favorites | Other Users | Analytics |
|------|---------------|--------------|-----------|
| Customer | ✅ Read/Write | ❌ | ❌ |
| Location Member | ✅ Read/Write | ❌ | ❌ |
| Location Owner | ✅ Read/Write | ✅ Read/Write | ✅ Location Scope |
| Organization Owner | ✅ Read/Write | ✅ Read/Write | ✅ Full Scope |

### Business Use Cases
- **Customer Experience:** Personal product collections and wishlists
- **Support Operations:** Staff assistance with customer preferences
- **Business Analytics:** Product popularity and customer behavior insights
- **Inventory Planning:** Data-driven stock decisions`,
      },
    ],
    components: {
      ...(response.components as Record<string, unknown> || {}),
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: `**JWT Authentication**

Used for user-based operations. Obtain a token by logging in via Supabase Auth.

**Header format:**
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\``,
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: `**API Key Authentication**

Used for headless/external integrations. Create an API key via the API Keys endpoints.

**Header format:**
\`\`\`
X-API-Key: jfy_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

**Permissions:** API keys can have granular permissions like \`read:products\`, \`write:orders\`, etc.`,
        },
      },
    },
  }

  setHeader(event, 'Content-Type', 'application/json')
  return filteredSpec
})
