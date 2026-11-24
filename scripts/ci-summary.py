"""Write counts from an offline Playwright JUnit report to a GitHub job summary."""
from pathlib import Path
import os
import sys
import xml.etree.ElementTree as ET

report = ET.parse(sys.argv[1]).getroot()
cases = list(report.iter('testcase'))
failed = sum(case.find('failure') is not None or case.find('error') is not None for case in cases)
skipped = sum(case.find('skipped') is not None for case in cases)
passed = len(cases) - failed - skipped
node = os.environ.get('NODE_VERSION', 'local')
summary = (f'## Offline Playwright · Node {node}\n\n'
           '| Total | Passed | Failed | Skipped |\n| --- | --- | --- | --- |\n'
           f'| {len(cases)} | {passed} | {failed} | {skipped} |\n\n'
           'HTML and JUnit results are available in the offline-report artifact.\n')
if os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
        output.write(summary)
else:
    print(summary)
if not cases:
    raise SystemExit('Merged report contains no test cases.')
if failed:
    raise SystemExit('Offline test report contains failures.')
