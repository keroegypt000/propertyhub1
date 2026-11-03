#!/usr/bin/env python3
# """إصلاح اتجاه كتل الكود في docx: إزالة RTL من فقرات SourceCode فقط"""
import zipfile, shutil, re

SRC = "/home/z/my-project/download/PropertyHub_Master_Prompt.docx"
TMP = "/tmp/docx_fix.docx"

with zipfile.ZipFile(SRC, "r") as zin:
    names = zin.namelist()
    contents = {n: zin.read(n) for n in names}

doc = contents["word/document.xml"].decode("utf-8")

fixed_count = 0

def fix_para(m):
    """يستهدف فقرة SourceCode ويحذف bidi من pPr و rtl من كل run داخليًا"""
    global fixed_count
    block = m.group(0)
    if '<w:pStyle w:val="SourceCode"' not in block:
        return block
    new = block.replace("<w:bidi />", "").replace("<w:bidi/>", "")
    new = new.replace("<w:rtl />", "").replace("<w:rtl/>", "")
    if new != block:
        fixed_count += 1
    return new

# فك كل فقرة <w:p> ... </w:p> واستبدالها بعد فحص نمطها
doc2 = re.sub(r"<w:p>.*?</w:p>", fix_para, doc, flags=re.DOTALL)

contents["word/document.xml"] = doc2.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, contents[n])

shutil.move(TMP, SRC)
print(f"fixed SourceCode paragraphs: {fixed_count}")
