# Advanced Markdown and Mermaid preview

Open this file in Fresh and run **Markdown: Toggle Compose/Preview**. Use
**Set Compose Width → None** for the full pane. Wide graphs keep their topology:
use **Markdown: Pan Diagrams Left**, **Right**, and **Center** to explore them.

This is an integration showcase, not a promise of complete Mermaid.js parity.
The diagrams below exercise our bundled renderer; colors and HTML styling are
intentionally absent from the terminal preview. Toggle back to source to edit.

## Coverage checklist

| Example | What to inspect |
| --- | --- |
| Delivery platform | Groups, fan-out, fan-in, labeled links, shared dependencies |
| Deployment pipeline | Decisions, failure paths, backward links, dotted links |
| Session lifecycle | Initial/final states, cycles, branching transitions |
| Checkout sequence | Participants, requests, replies, repeated interactions |
| Domain model | Inheritance, composition, associations, member lists |
| Relational model | Cardinalities, relationship labels, entity attributes |
| Reverse dependency graph | Right-to-left direction, converging dependencies |
| Shape catalogue | Alternative node shapes and long labels |

## 1. Delivery platform

Follow an incoming request through the gateway to several services. Notice that
multiple services share the database and event bus; these must remain single
nodes rather than being duplicated into separate panels.

```mermaid
flowchart TB
  CLIENT[Browser and mobile clients] -->|HTTPS| GATEWAY[API gateway]
  subgraph SERVICES[Application services]
    GATEWAY -->|validate| AUTH[Identity service]
    GATEWAY -->|browse| CATALOG[Product catalogue]
    GATEWAY -->|purchase| ORDERS[Order coordinator]
    GATEWAY -->|status| TRACKING[Shipment tracking]
    ORDERS -->|reserve| STOCK[Inventory worker]
    ORDERS -->|charge| PAYMENTS[Payment adapter]
  end
  subgraph DATA[Shared infrastructure]
    DB[(Transactional database)]
    CACHE[(Read cache)]
    BUS[Domain event bus]
  end
  AUTH --> DB
  CATALOG --> CACHE
  STOCK --> DB
  ORDERS --> DB
  ORDERS -->|publish| BUS
  BUS -->|notify| TRACKING
  BUS -->|receipt| MAIL[Notification worker]
  PAYMENTS --> PROVIDER[External payment provider]
```

**After the diagram:** this paragraph should stay visible and wrap normally,
even when the diagram extends beyond the pane.

## 2. Deployment pipeline with recovery

Both rejection and rollback return to earlier stages. Dotted notification edges
should remain distinct from the main deployment path.

```mermaid
flowchart LR
  PUSH[Push changes] --> BUILD[Build artifact]
  BUILD --> TEST{Tests pass?}
  TEST -->|yes| STAGE[Deploy staging]
  TEST -->|no| FIX[Fix changes]
  FIX --> PUSH
  STAGE --> REVIEW{Approved?}
  REVIEW -->|yes| CANARY[Canary release]
  REVIEW -->|no| FIX
  CANARY --> HEALTH{Healthy?}
  HEALTH -->|yes| PROD[Promote production]
  HEALTH -->|no| ROLLBACK[Restore last release]
  ROLLBACK --> FIX
  PROD -.-> AUDIT[Audit log]
  ROLLBACK -.-> AUDIT
```

## 3. Session lifecycle

Expiration and explicit sign-out converge on cleanup. A disconnected session can
resume without creating another authenticated session.

```mermaid
stateDiagram-v2
  [*] --> Anonymous
  Anonymous --> Authenticating: sign in
  Authenticating --> Active: credentials accepted
  Authenticating --> Anonymous: credentials rejected
  Active --> Suspended: connection lost
  Suspended --> Active: reconnect
  Suspended --> Closing: timeout
  Active --> Closing: sign out
  Closing --> Anonymous: cleanup complete
  Anonymous --> [*]: exit
```

## 4. Checkout sequence

The same participants communicate several times. Request and response arrows
should preserve their direction and their message text.

```mermaid
sequenceDiagram
  participant User
  participant Web
  participant API
  participant Inventory
  participant Payments
  User->>Web: Submit checkout
  Web->>API: POST order with request key
  API->>Inventory: Reserve requested items
  Inventory-->>API: Reservation token
  API->>Payments: Authorize total
  Payments-->>API: Authorization accepted
  API->>Inventory: Commit reservation
  Inventory-->>API: Stock updated
  API-->>Web: Order confirmed
  Web-->>User: Show receipt
  User->>Web: Refresh order
  Web->>API: GET order status
  API-->>Web: Confirmed
  Web-->>User: Display confirmation
```

## 5. Domain model

Inspect arrow endpoints as well as the class member text. A text renderer may
approximate UML decorations, but each relationship should remain represented.

```mermaid
classDiagram
  class Entity {
    +String id
    +Date createdAt
  }
  class Customer {
    +String email
    +placeOrder()
  }
  class Order {
    +String status
    +Money total
    +confirm()
    +cancel()
  }
  class LineItem {
    +int quantity
    +Money unitPrice
  }
  class Product {
    +String sku
    +String title
  }
  Entity <|-- Customer
  Entity <|-- Order
  Customer "1" --> "many" Order : places
  Order "1" *-- "many" LineItem : contains
  LineItem --> Product : references
```

## 6. Relational model

Entities have multiple attributes, and the join entity connects orders to
products. Check that relationship labels survive the compact layout.

```mermaid
erDiagram
  CUSTOMER ||--o{ SALES_ORDER : places
  SALES_ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : appears_in
  SALES_ORDER ||--o{ PAYMENT : receives
  CUSTOMER {
    string id PK
    string email
    string display_name
  }
  SALES_ORDER {
    string id PK
    string customer_id FK
    string status
  }
  ORDER_ITEM {
    string order_id FK
    string product_id FK
    int quantity
  }
  PRODUCT {
    string id PK
    string sku
    decimal price
  }
  PAYMENT {
    string id PK
    string order_id FK
    decimal amount
  }
```

## 7. Reverse dependency graph

This graph deliberately reads from right to left. The shared runtime must have
three incoming links, while the utilities node has two.

```mermaid
flowchart RL
  EDITOR[Editor application] --> PREVIEW[Markdown preview]
  EDITOR --> SEARCH[Search extension]
  EDITOR --> TERMINAL[Terminal extension]
  PREVIEW --> RUNTIME[Plugin runtime]
  SEARCH --> RUNTIME
  TERMINAL --> RUNTIME
  PREVIEW --> UTILS[Text utilities]
  SEARCH --> UTILS
```

## 8. Shape catalogue and label wrapping

Inspect recognizable shapes and readable labels. The long processing label
should wrap inside its node rather than causing the surrounding prose to wrap
as diagram content.

```mermaid
flowchart TB
  START([Start preview request]) --> INPUT[/Markdown source/]
  INPUT --> PARSE[Parse fenced blocks and preserve original source positions]
  PARSE --> VALID{Supported input?}
  VALID -->|yes| WORK[[Isolated rendering worker]]
  VALID -->|no| SOURCE[Keep editable source]
  WORK --> STORE[(Bounded result cache)]
  STORE --> OUTPUT[/Unicode preview rows/]
  OUTPUT --> DONE([Finished])
  SOURCE --> DONE
```

## Markdown around diagrams

### Normal formatting

- **Bold**, *italic*, and `inline code` should still work.
- [Local basic example](mermaid.md) should remain a normal Markdown link.
- Diagrams above must not consume this list or the following code block.

> Preview output is derived from the source. Toggle compose off to inspect or
> edit the original Mermaid without losing its formatting.

```typescript
const example = { language: 'mermaid', mode: 'preview' };
console.log(example);
```

### Intentional failure fallback

This final block is deliberately invalid. It should stay visible as source,
without freezing the editor or affecting the valid diagrams above.

```mermaid
this is deliberately not a Mermaid diagram
```

**End of showcase.** This sentence should remain visible after the failed block.
