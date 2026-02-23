import sys

if __name__ == "__main__":
    if "--watch" in sys.argv:
        sys.argv.remove("--watch")
        from etl.watcher import main as watcher_main

        watcher_main()
    else:
        from etl.run import main

        main()
