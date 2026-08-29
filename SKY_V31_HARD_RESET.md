# V3.1 hard sky reset

The screenshot showed that old hero rules were still winning for descendants inside the plane/cloud wrappers.
This patch hard-limits both the wrappers AND the nested SVG/image elements.

Desktop:
- plane 82 x 42 px
- clouds 72–110 px wide
- sun 58 px
- compact 120 px airstream
- plane flies left-to-right while climbing

This is deliberately appended last with !important so legacy V2.8/V2.9 rules cannot make the artwork huge.
