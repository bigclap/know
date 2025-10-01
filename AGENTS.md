### Part 1: EBCA Architecture (ECS + Event-Driven) — Concise Guide

**What is EBCA?**
A hybrid of **ECS** (data/behavior separation) and **EDA** (logic reacts to events via NATS).

* **Data** lives in **Components**.
* **Behavior** lives in **Systems**.
* **Entities** are just IDs binding components.
* **Systems don’t call each other**; they react to events.

---

### Core Blocks

#### 1) Entity

* **Just an ID** (e.g., `UserEntity` with fundamental fields only like `id`, `elo`, `nickname`).
* Purpose: group components.
* Principle: **KISS** — keep entities minimal.

#### 2) Component

* **Pure data class** (no methods), from `BaseComponent`.
* Goal: describe one atomic aspect of state.
* Principle: **SRP**; prefer many small components over one “god” component (**SOLID** in practice).

**Types:**

* **State Components** — long-lived “what the entity is / has.”

    * Examples: `UserWalletComponent`, `SinglePlayerSessionComponent`.
    * Heuristic: if it’s a single noun (wallet, stats, inventory), it’s a component.
* **Command Components** — short-lived triggers (“do this now”).

    * Examples: `StartCommandComponent`, `SinglePlayerAnswerCommandComponent`.
    * Lifecycle: system handles → **immediately remove**; never persisted long.

#### 3) System

* **All business logic**, **no state**.
* Subscribes to events (e.g., “`StartCommandComponent` added to `UserEntity`”) via `@EbcaPattern`.
* On event: read needed components, decide, then add/remove components.
* Communication: **event-driven via NATS**, not direct calls.

#### 4) ComponentManager

* **Single interface** to add/get/remove components.
* Hides cache (Redis), persistence (TypeORM), and event emission (NATS).
* Principle: **DRY** — don’t touch Redis/NATS directly; always use `ComponentManager`.

---

### Design Principles Recap

* **KISS** for Entities.
* **SRP / SOLID** for Components.
* **Stateless Systems**, event-driven.
* **DRY** via `ComponentManager`.

That’s the essence: describe state with small components, react with stateless systems on events, and route all component I/O through `ComponentManager`.

### Part 2: TDD Workflow — Concise Guide

**Philosophy**
Write a failing test (**Red**), implement the minimal code to pass (**Green**), then improve without changing behavior (**Refactor**). Forces clear requirements and full logic coverage.

**Task Flow (from requirement to code)**

1. **Decompose the requirement (5 min) into EBCA terms**

* **Trigger (Command Component):** what user action starts the flow.
  *e.g., press “Single Player” → `SinglePlayerCommandComponent` on `UserEntity`.*
* **Guards (State Checks):** prerequisites on existing **State Components**.
  *e.g., ensure no `SinglePlayerSessionComponent`.*
* **Result (State Change):** add/update/remove **State Components**.
  *e.g., create `SinglePlayerSessionComponent: ACTIVE`, enqueue `SendMessageComponent`.*

2. **Create test file (Red)**

* Pick the **System** (e.g., `SinglePlayerSystem`).
* Add `single-player.system.spec.ts` next to the system.
* Describe scenario(s):
  `it('starts a new game if no active session exists', ...)`

3. **Write the failing test (AAA pattern)**

* **Arrange:** build Nest test module; **mock** dependencies (usually `ComponentManager`).

  ```ts
  const mockCm = { hasComponent: jest.fn(), addComponent: jest.fn(), removeComponent: jest.fn() };
  mockCm.hasComponent.mockResolvedValue(false); // no active session
  ```

  Create a `UserEntity` and the **Command Component**.
* **Act:** get system, call handler (e.g., `handleStartGame(entityId, cmd)`).
* **Assert:** verify interactions reflect expected **Result**.

  ```ts
  expect(mockCm.addComponent).toHaveBeenCalledWith(expect.any(UserEntity), expect.any(SinglePlayerSessionComponent));
  expect(mockCm.removeComponent).toHaveBeenCalledWith(expect.any(UserEntity), SinglePlayerCommandComponent);
  ```

  Add alternative-path tests (e.g., session already active → do nothing).

4. **Write minimal code (Green)**

* Implement handler with `@EbcaPattern` for the Trigger.
* Mirror the assertions: check guards → perform state changes → remove command.
* Run tests → green.

5. **Refactor**

* Improve naming, extract duplication, add logging.
* Run tests after every change.

---

### Part 3: Design Principles — Concise Guide

**SOLID**

* **S (Single Responsibility)**

    * **Components:** one state aspect each (e.g., `UserWalletComponent` ≠ stats).
    * **Systems:** one business process each (split large ones).
* **O (Open/Closed)**
  Extend by **adding** components/systems and handlers—avoid modifying existing systems.

**DRY**

* Always manipulate components via **ComponentManager** (single point for cache/DB/events consistency).
* Share complex logic via `@Injectable()` services; systems orchestrate, services execute.

**KISS**

* **Components = data only** (no methods; simple public readonly fields).
* **Systems = logic only** (stateless; data comes from events/manager).
* **Flow is one-way:** Command Component → System → State Component. Predictable and debuggable.

