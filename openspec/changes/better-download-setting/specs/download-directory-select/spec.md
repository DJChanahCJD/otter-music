## ADDED Requirements

### Requirement: Custom download directory on native platform
The system SHALL allow users on native platforms to specify a custom download directory as a relative path within `Directory.ExternalStorage`. When no custom directory is set, the system SHALL use the default path `Download/OtterMusic`.

#### Scenario: User sets custom download directory
- **WHEN** user enters a valid relative path (e.g., "Music/OtterDownloads") and confirms
- **THEN** all subsequent downloads SHALL be saved to `<ExternalStorage>/Music/OtterDownloads/`

#### Scenario: Custom directory does not exist
- **WHEN** user sets a custom directory that does not yet exist
- **THEN** the system SHALL create the directory recursively on the first download attempt

#### Scenario: Invalid custom directory
- **WHEN** user enters a path containing invalid characters (e.g., `..`, `*`, `?`)
- **THEN** the system SHALL show a validation error and SHALL NOT save the path

#### Scenario: Reset to default directory
- **WHEN** user clears the custom directory input or clicks "重置为默认"
- **THEN** the download directory SHALL revert to the default `Download/OtterMusic`

#### Scenario: Existing download records persist
- **WHEN** user changes the download directory
- **THEN** previously downloaded files SHALL remain in their original location, and download records SHALL still reference them correctly

### Requirement: Download directory UI
The system SHALL provide a text input field in the download settings section for entering a custom download directory. The input SHALL only be visible on native platforms.

#### Scenario: Directory input on native
- **WHEN** user is on an Android device and navigates to download settings
- **THEN** a SettingItem with a text input for download directory SHALL be displayed, showing the current directory path or placeholder text "默认目录"

#### Scenario: Directory path display
- **WHEN** a custom download directory is set
- **THEN** the input SHALL display the current custom path
- **WHEN** no custom directory is set
- **THEN** the input SHALL display a placeholder indicating the default path ("Download/OtterMusic")
