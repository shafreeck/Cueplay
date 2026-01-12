# Cloud Drive Management & Permission Model

## 1. Core Entities

### Drive Account (`DriveAccount`)
Represents a connection to a cloud storage provider (currently Quark).
- **Types**:
  - **Personal Drive**: Bind to a specific `userId`. Private by default.
  - **System Drive**: Global configuration (`isSystem: true`). Available to all users/rooms.
- **Attributes**:
  - `id`: Unique identifier (UUID).
  - `name`: User-defined name or nickname from the provider.
  - `isSystem`: Boolean flag for system-level drives.
  - `isShared`: Boolean flag (Personal drives only) to allow room-level sharing.
  - `data.cookie`: Functional credential for API access.

### Resource Library
The central interface for browsing files.
- **Scope**: Can be opened in "Personal" context (User Profile) or "Room" context (Room Page).
- **Behavior**:
  - **Inputs**: `roomId`, `userId`.
  - **Display**: Lists all Personal Drives for `userId` + the Global System Drive.

## 2. Authentication & Permission Model

### System Drive Access
- **Restriction**: System drives are generally protected.
- **Mechanism**: **Auth Code**.
  - Users must enter a valid "Authorization Code" to access System Drive content if the backend requires it.
  - This code is verified against the backend configuration.
  - **Client Storage**: Validated codes are stored in `localStorage` (`cueplay_system_auth_code`).
  - **Priority**: If an Auth Code is present, it takes precedence for System Drive requests.

### Personal Drive Access
- **Mechanism**: **Cookie**.
  - Direct access via the stored `cookie` credential.
- **Sharing**:
  - If `isShared` is true, other members in the `roomId` can *read* from this drive (implementation detail: backend proxies the request using the owner's cookie).

### Conflict Resolution & Fallback
The system follows a strict priority order to prevent data confusion (e.g., seeing Drive A files when you think you are in Drive B):
1.  **Explicit Selection**: `selectedDriveId` matches a valid drive.
    - **System**: Uses Auth Code (if required).
    - **Personal**: Uses Drive Cookie.
2.  **Explicit Auth**: If no drive is selected but an Auth Code exists, assumes System Context.
3.  **Legacy Fallback**: *Deprecated/Low Priority*. Only if no drives are connected and no Auth Code exists, the system attempts to use a legacy/global fallback cookie if configured.

## 3. Test Scenarios & Verification

### Scenario 1: Personal Drive Management
- **Action**: Add a new drive via Manual Cookie Input.
- **Expected Result**: 
  - Drive appears in sidebar with correct Name.
  - Files load using provided cookie.
  - **Status**: ✅ Verified.

### Scenario 2: System Drive Identification
- **Action**: View "Global Public Drive" in lists.
- **Expected Result**:
  - **Sidebar**: Displays simplified name + **"Public Shared Drive"** (🛡️) Badge.
  - **Header**: Displays "Public Shared Drive" Badge next to name.
  - **Status**: ✅ Verified.

### Scenario 3: Context Switching
- **Action**: Switch between Personal and System drives.
- **Expected Result**: 
  - File list refreshes immediately.
  - Header badge appears/disappears correctly based on drive type.
  - No cross-talk of data (e.g. System files showing in Personal view).
  - **Status**: ✅ Verified.

### Scenario 4: Permission Enforcement
- **Action**: Access System Drive without Auth Code (if enabled).
- **Expected Result**: UI prompts for Authorization Code. files are locked.
- **Status**: ✅ Verified (Logic exists in `ResourceLibrary`).
