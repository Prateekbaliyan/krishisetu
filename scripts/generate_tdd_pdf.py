import os
import re
import subprocess
import sys

def clean_latex_math(s):
    # Strip $$ or $ if present
    s = s.strip()
    if s.startswith('$$') and s.endswith('$$'):
        s = s[2:-2].strip()
    elif s.startswith('$') and s.endswith('$'):
        s = s[1:-1].strip()

    # Replacements
    s = re.sub(r'\\text\{([^}]+)\}', r'\1', s)
    s = re.sub(r'\\max', 'max', s)
    s = re.sub(r'\\times', '×', s)
    s = re.sub(r'\\left\(', '(', s)
    s = re.sub(r'\\right\)', ')', s)
    s = re.sub(r'\\left\[', '[', s)
    s = re.sub(r'\\right\]', ']', s)
    s = re.sub(r'\\le(?![a-zA-Z])', '≤', s)
    s = re.sub(r'\\ge(?![a-zA-Z])', '≥', s)
    # Fractions: \frac{A}{B} -> (A / B) or [A / B]
    s = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'(\1 / \2)', s)
    s = re.sub(r'\\mid|\\parallel', '∥', s)
    s = re.sub(r'\\%', '%', s)
    s = re.sub(r'_\{([^}]+)\}', r'<sub>\1</sub>', s)
    s = re.sub(r'_([a-zA-Z0-9])', r'<sub>\1</sub>', s)
    s = s.replace('\\', '')
    return s.strip()

def format_inline(text):
    # Display math $$ ... $$
    def replace_display_math(match):
        raw = match.group(1)
        cleaned = clean_latex_math(raw)
        return f'<div class="math-block">{cleaned}</div>'

    text = re.sub(r'\$\$(.*?)\$\$', replace_display_math, text)

    # Inline math $ ... $
    def replace_inline_math(match):
        raw = match.group(1)
        cleaned = clean_latex_math(raw)
        return f'<span class="math-inline">{cleaned}</span>'

    text = re.sub(r'\$([^\$]+?)\$', replace_inline_math, text)

    # Bold
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    # Italic
    text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
    # Inline code
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # Links
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    return text

def parse_markdown_to_html(md_text):
    lines = md_text.split('\n')
    html_lines = []
    
    in_table = False
    table_header_done = False
    in_code = False
    code_lang = ""
    code_lines = []

    # List management stack: [(indent, type)]
    list_stack = []

    def close_all_lists():
        res = []
        while list_stack:
            item = list_stack.pop()
            res.append(f'</li></{item[1]}>')
        return res

    def close_table():
        nonlocal in_table, table_header_done
        res = []
        if in_table:
            in_table = False
            table_header_done = False
            res.append('</tbody></table></div>')
        return res

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Code block
        if stripped.startswith('```'):
            html_lines.extend(close_all_lists())
            html_lines.extend(close_table())
            if in_code:
                in_code = False
                code_content = '\n'.join(code_lines)
                if code_lang == 'mermaid':
                    html_lines.append(get_architecture_svg())
                else:
                    html_lines.append(f'<pre><code class="language-{code_lang}">{escape_html(code_content)}</code></pre>')
                code_lines = []
            else:
                in_code = True
                code_lang = stripped[3:].strip()
                code_lines = []
            i += 1
            continue

        if in_code:
            code_lines.append(line)
            i += 1
            continue

        # Table row
        if stripped.startswith('|') and stripped.endswith('|'):
            html_lines.extend(close_all_lists())
            if not in_table:
                in_table = True
                table_header_done = False
                html_lines.append('<div class="table-container"><table>')
            
            if re.match(r'^\|[\s\-:|]+\|$', stripped):
                table_header_done = True
                i += 1
                continue
            
            cells = [c.strip() for c in stripped[1:-1].split('|')]
            if not table_header_done:
                html_lines.append('<thead><tr>' + ''.join(f'<th>{format_inline(c)}</th>' for c in cells) + '</tr></thead><tbody>')
            else:
                html_lines.append('<tr>' + ''.join(f'<td>{format_inline(c)}</td>' for c in cells) + '</tr>')
            i += 1
            continue
        else:
            if in_table:
                html_lines.extend(close_table())

        # Empty line
        if not stripped:
            i += 1
            continue

        # Headings
        if stripped.startswith('# ') or stripped.startswith('## ') or stripped.startswith('### ') or stripped.startswith('#### '):
            html_lines.extend(close_all_lists())
            html_lines.extend(close_table())
            if stripped.startswith('# '):
                html_lines.append(f'<h1 class="doc-title">{format_inline(stripped[2:])}</h1>')
            elif stripped.startswith('## '):
                html_lines.append(f'<h2>{format_inline(stripped[3:])}</h2>')
            elif stripped.startswith('### '):
                html_lines.append(f'<h3>{format_inline(stripped[4:])}</h3>')
            elif stripped.startswith('#### '):
                html_lines.append(f'<h4>{format_inline(stripped[5:])}</h4>')
            i += 1
            continue

        # Horizontal rule
        if stripped == '---':
            html_lines.extend(close_all_lists())
            html_lines.extend(close_table())
            html_lines.append('<hr/>')
            i += 1
            continue

        # Standalone Display Math block: $$ ... $$
        if stripped.startswith('$$') and stripped.endswith('$$') and len(stripped) > 2:
            html_lines.extend(close_all_lists())
            html_lines.extend(close_table())
            cleaned = clean_latex_math(stripped)
            html_lines.append(f'<div class="math-block">{cleaned}</div>')
            i += 1
            continue

        # Check for list items
        m_ol = re.match(r'^(\s*)(\d+)\.\s+(.*)$', line)
        m_ul = re.match(r'^(\s*)[-*]\s+(.*)$', line)

        if m_ol or m_ul:
            html_lines.extend(close_table())
            if m_ol:
                indent = len(m_ol.group(1))
                content = m_ol.group(3)
                ltype = 'ol'
            else:
                indent = len(m_ul.group(1))
                content = m_ul.group(2)
                ltype = 'ul'

            # Pop lists deeper than current indent
            while list_stack and list_stack[-1][0] > indent:
                item = list_stack.pop()
                html_lines.append(f'</li></{item[1]}>')

            # If no list or deeper indent, push new list
            if not list_stack or list_stack[-1][0] < indent:
                list_stack.append((indent, ltype))
                html_lines.append(f'<{ltype}><li>{format_inline(content)}')
            elif list_stack[-1][0] == indent:
                # Same level: check if list type changed
                if list_stack[-1][1] != ltype:
                    item = list_stack.pop()
                    html_lines.append(f'</li></{item[1]}><{ltype}><li>{format_inline(content)}')
                    list_stack.append((indent, ltype))
                else:
                    html_lines.append(f'</li><li>{format_inline(content)}')
            i += 1
            continue

        # Regular paragraph
        html_lines.extend(close_all_lists())
        html_lines.extend(close_table())
        if stripped.startswith('**GitHub Repository:**') or stripped.startswith('**Live Application URL:**') or stripped.startswith('**Backend API URL:**'):
            html_lines.append(f'<p class="meta-line">{format_inline(stripped)}</p>')
        else:
            html_lines.append(f'<p>{format_inline(stripped)}</p>')
        i += 1

    html_lines.extend(close_all_lists())
    html_lines.extend(close_table())
    return '\n'.join(html_lines)

def escape_html(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def get_architecture_svg():
    return """
<div class="arch-diagram-wrapper">
<svg viewBox="0 0 880 430" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <filter id="shadow" x="-2%" y="-2%" width="104%" height="106%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08" />
    </filter>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 8 5 L 0 9 z" fill="#24452F" />
    </marker>
  </defs>

  <!-- Container: Village Collection Centres -->
  <rect x="20" y="20" width="260" height="380" rx="10" fill="#f4f7f3" stroke="#527A50" stroke-width="1.5" />
  <rect x="20" y="20" width="260" height="34" rx="10" fill="#24452F" />
  <rect x="20" y="44" width="260" height="10" fill="#24452F" />
  <text x="150" y="42" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">Village Collection Centres (22 Mandis)</text>

  <!-- Node: Operator -->
  <rect x="40" y="70" width="220" height="55" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="150" y="93" fill="#1e293b" font-size="12" font-weight="bold" text-anchor="middle">Centre Operator</text>
  <text x="150" y="111" fill="#64748b" font-size="10" text-anchor="middle">Android / Tablet / Desktop Web App</text>

  <!-- Node: Dexie IndexedDB -->
  <rect x="40" y="145" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="150" y="167" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">IndexedDB (Dexie.js)</text>
  <text x="150" y="183" fill="#64748b" font-size="9.5" text-anchor="middle">Offline Queue &amp; Master Data Cache</text>

  <!-- Node: Service Worker -->
  <rect x="40" y="215" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="150" y="237" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">Native Service Worker</text>
  <text x="150" y="253" fill="#64748b" font-size="9.5" text-anchor="middle">Offline PWA AppShell Caching</text>

  <!-- Node: Camera & Sensors -->
  <rect x="40" y="285" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="150" y="307" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">Weighbridge &amp; Moisture Sensors</text>
  <text x="150" y="323" fill="#64748b" font-size="9.5" text-anchor="middle">Camera Display Photo Capture</text>


  <!-- Container: Central Office -->
  <rect x="310" y="20" width="260" height="380" rx="10" fill="#f4f7f3" stroke="#527A50" stroke-width="1.5" />
  <rect x="310" y="20" width="260" height="34" rx="10" fill="#24452F" />
  <rect x="310" y="44" width="260" height="10" fill="#24452F" />
  <text x="440" y="42" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">Central Office (Latur APMC Hub)</text>

  <!-- Node: Manager Dashboard -->
  <rect x="330" y="70" width="220" height="55" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="440" y="93" fill="#1e293b" font-size="12" font-weight="bold" text-anchor="middle">Office Manager Dashboard</text>
  <text x="440" y="111" fill="#64748b" font-size="10" text-anchor="middle">Company-Wide Procurement Oversight</text>

  <!-- Node: Price Board -->
  <rect x="330" y="145" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="440" y="167" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">Daily Price Board</text>
  <text x="440" y="183" fill="#64748b" font-size="9.5" text-anchor="middle">MSP &amp; Quality Grid Publication</text>

  <!-- Node: Anomaly Resolution -->
  <rect x="330" y="215" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="440" y="237" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">Anomaly Review Queue</text>
  <text x="440" y="253" fill="#64748b" font-size="9.5" text-anchor="middle">Manager Variance Approval Gate</text>

  <!-- Node: Bank Batch Engine -->
  <rect x="330" y="285" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="440" y="307" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">Bank Batch Payment Engine</text>
  <text x="440" y="323" fill="#64748b" font-size="9.5" text-anchor="middle">NEFT / NACH Bulk Payment CSV</text>


  <!-- Container: Backend & Database -->
  <rect x="600" y="20" width="260" height="380" rx="10" fill="#f4f7f3" stroke="#527A50" stroke-width="1.5" />
  <rect x="600" y="20" width="260" height="34" rx="10" fill="#24452F" />
  <rect x="600" y="44" width="260" height="10" fill="#24452F" />
  <text x="730" y="42" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">Backend API &amp; Data Layer</text>

  <!-- Node: REST Services -->
  <rect x="620" y="70" width="220" height="55" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="730" y="93" fill="#1e293b" font-size="12" font-weight="bold" text-anchor="middle">Node.js / Express API</text>
  <text x="730" y="111" fill="#64748b" font-size="10" text-anchor="middle">JWT RBAC, Sync &amp; Payment Routes</text>

  <!-- Node: AI OCR Provider -->
  <rect x="620" y="145" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="730" y="167" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">Google Gemini Vision OCR</text>
  <text x="730" y="183" fill="#64748b" font-size="9.5" text-anchor="middle">gemini-3.5-flash-lite (15s Timeout)</text>

  <!-- Node: Prisma ORM -->
  <rect x="620" y="215" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="730" y="237" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">Prisma ORM (Dual Schema)</text>
  <text x="730" y="253" fill="#64748b" font-size="9.5" text-anchor="middle">PostgreSQL (Prod) / SQLite (Dev)</text>

  <!-- Node: Audit Chain -->
  <rect x="620" y="285" width="220" height="50" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" filter="url(#shadow)" />
  <text x="730" y="307" fill="#1e293b" font-size="11" font-weight="bold" text-anchor="middle">SHA-256 Audit Ledger</text>
  <text x="730" y="323" fill="#64748b" font-size="9.5" text-anchor="middle">Cryptographic Chained Log Verification</text>

  <!-- Connectors -->
  <line x1="260" y1="95" x2="330" y2="95" stroke="#24452F" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arrow)" />
  <line x1="550" y1="95" x2="620" y2="95" stroke="#24452F" stroke-width="1.5" marker-end="url(#arrow)" />
  <line x1="260" y1="170" x2="620" y2="105" stroke="#24452F" stroke-width="1.2" stroke-dasharray="3 3" />
</svg>
</div>
"""

def generate_pdf():
    workspace = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tdd_md_path = os.path.join(workspace, 'docs', 'TECHNICAL_DESIGN_DOCUMENT.md')
    
    with open(tdd_md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    body_html = parse_markdown_to_html(md_text)

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>KrishiSetu — Technical Design Document</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 14mm 15mm 14mm 15mm;
    @bottom-right {{
      content: counter(page) " of " counter(pages);
      font-size: 8pt;
      color: #64748b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }}
  }}
  
  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 8.9pt;
    line-height: 1.44;
    color: #1e293b;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }}

  h1.doc-title {{
    color: #24452F;
    font-size: 17.5pt;
    font-weight: 800;
    margin: 0 0 3.5pt 0;
    letter-spacing: -0.4px;
    border-bottom: 2px solid #24452F;
    padding-bottom: 3.5pt;
  }}

  .meta-line {{
    margin: 1.5pt 0;
    font-size: 8.5pt;
    color: #334155;
  }}
  .meta-line strong {{
    color: #24452F;
  }}
  .meta-line a {{
    color: #2e603b;
    text-decoration: none;
    font-weight: 600;
  }}

  hr {{
    border: none;
    border-top: 1px solid #cbd5e1;
    margin: 6pt 0 7pt 0;
  }}

  h2 {{
    color: #24452F;
    font-size: 11.6pt;
    font-weight: 700;
    margin: 9pt 0 3pt 0;
    padding-bottom: 2pt;
    border-bottom: 1.2px solid #527A50;
    page-break-after: avoid;
  }}

  h3 {{
    color: #1e3a24;
    font-size: 9.8pt;
    font-weight: 700;
    margin: 6.5pt 0 2pt 0;
    page-break-after: avoid;
  }}

  h4 {{
    color: #24452F;
    font-size: 9pt;
    font-weight: 700;
    margin: 5pt 0 2pt 0;
    page-break-after: avoid;
  }}

  p {{
    margin: 2.5pt 0 3.5pt 0;
    text-align: justify;
  }}

  ul, ol {{
    margin: 2pt 0 3.5pt 0;
    padding-left: 14pt;
  }}

  li {{
    margin-bottom: 1.5pt;
    text-align: justify;
  }}

  /* Table Styling */
  .table-container {{
    margin: 4pt 0 6pt 0;
    page-break-inside: avoid;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 8.1pt;
    background: #ffffff;
  }}

  th {{
    background-color: #24452F;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 3.2pt 5pt;
    border: 1px solid #1a3322;
  }}

  td {{
    padding: 2.6pt 5pt;
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }}

  tr:nth-child(even) td {{
    background-color: #f8faf7;
  }}

  code {{
    font-family: "Consolas", "Liberation Mono", Courier, monospace;
    font-size: 7.9pt;
    background-color: #f1f5f9;
    color: #0f172a;
    padding: 0.5pt 2.5pt;
    border-radius: 2.5pt;
    border: 1px solid #e2e8f0;
  }}

  pre {{
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 3pt;
    padding: 3.5pt 5pt;
    font-size: 7.4pt;
    line-height: 1.35;
    overflow-x: hidden;
    margin: 3.5pt 0;
    page-break-inside: avoid;
  }}

  pre code {{
    border: none;
    background: transparent;
    padding: 0;
  }}

  .math-block {{
    background: #f4f7f3;
    border-left: 2.5px solid #527A50;
    padding: 3pt 6pt;
    margin: 2.5pt 0;
    font-family: "Cambria Math", "Georgia", "Times New Roman", serif;
    font-size: 9.1pt;
    color: #1e3a24;
    page-break-inside: avoid;
  }}

  .math-inline {{
    font-family: "Cambria Math", "Georgia", "Times New Roman", serif;
    color: #1e3a24;
    font-weight: 500;
  }}

  .arch-diagram-wrapper {{
    margin: 4.5pt 0 6pt 0;
    text-align: center;
    page-break-inside: avoid;
    max-height: 270px;
  }}

  .arch-diagram-wrapper svg {{
    max-height: 270px;
    width: auto;
  }}
</style>
</head>
<body>
{body_html}
</body>
</html>
"""

    html_path = os.path.join(workspace, 'docs', 'TDD_preview.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(full_html)
    
    print(f"Generated HTML preview at {html_path}")

    # Generate PDF via Chrome
    pdf_path_root = os.path.join(workspace, 'TDD.pdf')
    pdf_path_docs = os.path.join(workspace, 'docs', 'TDD.pdf')

    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_path):
        chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

    cmd = [
        chrome_path,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        f"--print-to-pdf={pdf_path_root}",
        html_path
    ]

    print("Running Chrome print-to-pdf...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    
    if os.path.exists(pdf_path_root):
        size_kb = os.path.getsize(pdf_path_root) / 1024
        print(f"Successfully generated {pdf_path_root} ({size_kb:.1f} KB)")
        with open(pdf_path_root, 'rb') as src, open(pdf_path_docs, 'wb') as dst:
            dst.write(src.read())
        print(f"Copied to {pdf_path_docs}")
    else:
        print("Failed to generate PDF. Chrome output:")
        print(res.stderr)
        sys.exit(1)

if __name__ == '__main__':
    generate_pdf()
