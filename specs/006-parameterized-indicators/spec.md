# Feature Specification: Parameterized Indicator Instances

**Feature Branch**: `006-parameterized-indicators`
**Created**: 2025-12-25
**Status**: Draft
**Input**: User description: "Implement parameterized indicator instances - allow indicators to be instantiated with different parameters, each getting a unique auto-generated name"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multiple Indicator Configurations (Priority: P1)

As a trader, I want to add the same technical indicator with different parameter values so I can compare how the indicator behaves with different settings (e.g., SMA with 20-period vs 50-period).

**Why this priority**: This is the core value of the feature - enabling traders to analyze multiple configurations of the same indicator simultaneously for better trading decisions.

**Independent Test**: Can be fully tested by registering the same indicator type with different parameters and verifying both appear as separate indicators with unique names.

**Acceptance Scenarios**:

1. **Given** a system with the SMA indicator registered, **When** a user registers a second SMA instance with a different period parameter, **Then** both SMA indicators are available with unique names (e.g., "sma" and "sma_50")
2. **Given** a system with no custom indicators, **When** a user registers SMA with default parameters and SMA with period=50, **Then** both indicators are listed separately in the available indicators
3. **Given** two SMA instances registered (period 20 and 50), **When** a user queries the indicator registry, **Then** both instances are returned with their respective parameter configurations

---

### User Story 2 - Automatic Unique Naming (Priority: P1)

As a system, I want to automatically generate unique names for indicator instances so that users don't need to manually name each instance.

**Why this priority**: Essential for usability - eliminates the need for users to invent unique names and reduces errors from duplicate names.

**Independent Test**: Can be tested by registering multiple instances of the same indicator and verifying each receives a unique auto-generated name without conflicts.

**Acceptance Scenarios**:

1. **Given** an indicator registry, **When** the same indicator class is registered twice, **Then** the second instance receives a name with a parameter suffix (e.g., "sma_50" for SMA with period=50)
2. **Given** three instances of SMA registered (periods 20, 50, 200), **When** listing all indicators, **Then** each has a unique name: "sma", "sma_50", "sma_200"
3. **Given** an indicator registered with custom parameters, **When** its name is generated, **Then** the name incorporates the distinguishing parameter(s)

---

### User Story 3 - Indicator Discovery and Listing (Priority: P2)

As a trader, I want to see all available indicator instances including their parameters so I can select the right one for my analysis.

**Why this priority**: Important for usability - users need to discover what indicators are available and understand their configurations.

**Independent Test**: Can be tested by querying the indicator list and verifying all instances are displayed with their parameters.

**Acceptance Scenarios**:

1. **Given** multiple indicator instances registered, **When** a user requests the list of available indicators, **Then** all instances are listed with their names and parameter values
2. **Given** an indicator with custom parameters, **When** viewing the indicator list, **Then** the parameters are visible alongside the indicator name
3. **Given** an SMA with period=20 and SMA with period=50, **When** the user browses indicators, **Then** both are distinguishable by their names and parameter values

---

### User Story 4 - Backward Compatibility (Priority: P1)

As an existing user, I want my current indicator configurations to continue working so that my analysis is not disrupted.

**Why this priority**: Critical for system stability - existing users must not lose their current setups during the upgrade.

**Independent Test**: Can be tested by registering an indicator with default parameters and verifying it uses the same name as before (e.g., "sma" for SMA with period=20).

**Acceptance Scenarios**:

1. **Given** existing code that registers SMA() with default parameters, **When** the system is upgraded, **Then** the indicator is still registered as "sma" (no change)
2. **Given** existing API responses that reference indicator "sma", **When** queries are made after upgrade, **Then** "sma" still resolves to the default SMA indicator
3. **Given** existing user configurations referencing indicator names, **When** the system restarts with new code, **Then** all references remain valid

---

### User Story 5 - Parameter Serialization (Priority: P2)

As a system, I want to store indicator parameters so that configurations can be saved and restored across sessions.

**Why this priority**: Important for persistence - users need their indicator setups to be remembered.

**Storage Mechanism**: Standard indicator variants are defined in code (`initialization.py`). User-defined custom variants are persisted to a JSON file (`backend/app/services/indicator_registry/registered_indicators.json`) and restored at application startup via `load_registered_indicators()`.

**Independent Test**: Can be tested by saving an indicator configuration to JSON, restarting the app, and verifying parameters are preserved.

**Acceptance Scenarios**:

1. **Given** an indicator instance with custom parameters, **When** the configuration is saved to JSON and reloaded, **Then** the indicator is restored with identical parameters
2. **Given** multiple user-defined indicator instances, **When** the system restarts, **Then** all custom instances are re-registered from JSON with their original parameters
3. **Given** an indicator with period=50, **When** serialized to JSON storage, **Then** the parameter value is preserved in the stored data

---

### Edge Cases

- What happens when two instances have identical parameters?
  - **Resolved**: Last write wins. If two instances with identical parameters are registered, the second overwrites the first. This is acceptable for standard variants and prevents ambiguity.
- What happens when an indicator has no parameters?
  - **Resolved**: Single instance uses base name (e.g., "sma"). The `name` property returns `base_name` when `_default_params` is empty.
- What happens when parameter values are objects/arrays?
  - **Resolved**: Out of scope for this feature. Per Assumption #3, parameters are limited to simple types (integers, strings, booleans). Future enhancement could add complex type support.
- What happens when the default instance is registered after parameterized instances?
  - **Resolved**: Naming is deterministic based on parameters. Default (empty params) always gets base name; parameterized instances always get parameter suffix. Registration order doesn't affect name generation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow multiple instances of the same indicator type with different parameter values
- **FR-002**: System MUST automatically generate unique names for each indicator instance based on its parameters
- **FR-003**: System MUST use the base indicator name for the instance with default parameters (e.g., "sma" for SMA with period=20)
- **FR-004**: System MUST append distinguishing parameter values to names for non-default instances (e.g., "sma_50", "sma_200")
- **FR-005**: System MUST prevent name collisions between indicator instances
- **FR-006**: System MUST maintain backward compatibility with existing indicator names and API responses
- **FR-007**: System MUST provide a way to query all registered indicator instances with their parameters
- **FR-008**: System MUST serialize indicator parameters to JSON for persistence across sessions (user-defined variants only; standard variants are code-defined)
- **FR-009**: System MUST support all existing indicator types (SMA, EMA, TDFI, CRSI, ADXVMA) with parameterization
- **FR-010**: System MUST validate parameter values during indicator instantiation

### Key Entities

- **Indicator Instance**: A specific instantiation of an indicator type with a unique set of parameter values
- **Indicator Type**: The class or template of an indicator (e.g., SMA, EMA, CRSI)
- **Parameter Configuration**: The set of parameter values that distinguish one instance from another
- **Indicator Registry**: The collection of all registered indicator instances with their names and configurations
- **Instance Name**: The unique identifier for an indicator instance, auto-generated from type and parameters

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can register 10+ instances of the same indicator with different parameters without name conflicts
- **SC-002**: Indicator instance names are automatically generated in under 10 milliseconds per registration
- **SC-003**: 100% of existing indicator configurations remain functional after system upgrade (backward compatibility)
- **SC-004**: Users can successfully retrieve and use any registered indicator instance by its generated name
- **SC-005**: System can handle 100+ registered indicator instances without performance degradation

## Assumptions

1. Default parameter values are defined for each indicator type (e.g., period=20 for SMA)
2. Indicator names are case-insensitive for lookups
3. Parameter values that distinguish instances are limited to simple types (integers, strings, booleans)
4. The indicator registry is in-memory and populated at application startup from code-defined standard variants and JSON-loaded user-defined variants
5. Existing API endpoints will return additional parameter information in responses
6. Frontend auto-discovers indicators via the existing `/api/v1/indicators/supported` endpoint - no frontend code changes required

## Dependencies

- Existing indicator base class architecture
- Indicator registry system for managing indicator instances
- API endpoints for listing and querying indicators
- Frontend components for indicator selection and display

## Out of Scope

- UI for creating custom indicator instances (assumes programmatic registration)
- Dynamic parameter changes at runtime (indicators are instantiated at startup)
- Sharing/saving custom indicator configurations between users
- Visual comparison tools for multiple indicator instances
- Automatic deletion of unused indicator instances
