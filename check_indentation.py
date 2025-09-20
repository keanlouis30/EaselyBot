#!/usr/bin/env python3
"""
Check for indentation issues in Python files
"""

import ast
import sys

def check_file(filepath):
    """Check a Python file for syntax and indentation errors"""
    try:
        with open(filepath, 'r') as f:
            source = f.read()
        
        # Try to parse the file
        ast.parse(source)
        print(f"✅ {filepath}: No syntax or indentation errors")
        return True
    except IndentationError as e:
        print(f"❌ {filepath}: IndentationError on line {e.lineno}")
        print(f"    Error: {e.msg}")
        print(f"    Text: {e.text}")
        return False
    except SyntaxError as e:
        print(f"❌ {filepath}: SyntaxError on line {e.lineno}")
        print(f"    Error: {e.msg}")
        return False
    except Exception as e:
        print(f"❌ {filepath}: Unexpected error: {e}")
        return False

def main():
    files_to_check = [
        'app/core/event_handler.py',
        'app/api/messenger_api.py',
        'app/api/canvas_api.py'
    ]
    
    print("Checking Python files for indentation issues...")
    print("=" * 50)
    
    all_good = True
    for filepath in files_to_check:
        if not check_file(filepath):
            all_good = False
        print()
    
    print("=" * 50)
    if all_good:
        print("✅ All files are free of indentation errors!")
        print("\nThe application should now start without IndentationError.")
        return 0
    else:
        print("❌ Some files have issues. Please review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())