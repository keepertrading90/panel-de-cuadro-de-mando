import os, sys, subprocess
PYTHON_PATH = r"Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe"

def main():
    if len(sys.argv) < 2:
        sys.exit(1)
    
    # Ejecución silenciosa
    subprocess.run([PYTHON_PATH, "scripts/qa_scanner.py"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["git", "add", "."], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["git", "commit", "-m", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["git", "push", "origin", "main"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    sys.exit(0)

if __name__ == "__main__":
    main()