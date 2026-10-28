!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
  Var tyDesktopCheckbox
  Var tyDesktopSelected

  !macro customInit
    StrCpy $tyDesktopSelected ${BST_CHECKED}
  !macroend

  !macro customPageAfterChangeDir
    Page custom tyShortcutsPage tyShortcutsLeave
  !macroend

  !macro customHeader
    Function tyShortcutsPage
      !insertmacro MUI_HEADER_TEXT "Shortcuts" "Choose how to access TradersYard Journal."
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}
      ${NSD_CreateLabel} 0 0 100% 28u "A Start menu entry is included. Your journal and sign-in session stay separate for each Windows user."
      Pop $0
      ${NSD_CreateCheckbox} 0 42u 100% 14u "Add a desktop shortcut"
      Pop $tyDesktopCheckbox
      ${NSD_SetState} $tyDesktopCheckbox $tyDesktopSelected
      ${NSD_CreateLabel} 0 72u 100% 40u "You can also pin Journal to the taskbar after installation. Select the taskbar instructions option on the final setup screen."
      Pop $0
      nsDialogs::Show
    FunctionEnd

    Function tyShortcutsLeave
      ${NSD_GetState} $tyDesktopCheckbox $tyDesktopSelected
    FunctionEnd

    Function tyStartJournal
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
    FunctionEnd

    Function tyTaskbarInstructions
      MessageBox MB_OK|MB_ICONINFORMATION "To pin TradersYard Journal to your taskbar:$\r$\n$\r$\n1. Open TradersYard Journal from the Start menu or desktop.$\r$\n2. Right-click its running icon on the Windows taskbar.$\r$\n3. Select 'Pin to taskbar'.$\r$\n$\r$\nWindows completes this action when you select it. Your organization's Windows policy may control whether pinning is available."
    FunctionEnd
  !macroend

  !macro customInstall
    ${If} $tyDesktopSelected == ${BST_CHECKED}
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
      System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    ${EndIf}
  !macroend

  !macro customFinishPage
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION tyStartJournal
    !define MUI_FINISHPAGE_SHOWREADME ""
    !define MUI_FINISHPAGE_SHOWREADME_TEXT "Show how to pin Journal to the taskbar"
    !define MUI_FINISHPAGE_SHOWREADME_FUNCTION tyTaskbarInstructions
    !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
    !insertmacro MUI_PAGE_FINISH
  !macroend
!endif
