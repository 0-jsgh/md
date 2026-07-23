# MARKDOWN Editor

# md-render.js — Offline Demo

To use `md-render.js` in any HTML page, include:

```html
<script src="https://htmltomd.netlify.app/md-render.js"></ script>
```
- Delete space in </ script>.

---

Works **completely offline**. All required libraries are included in the `libs/` folder.

---

## Text and Emphasis

Regular paragraph with **bold**, *italic*, and `inline code`.

> Blockquote — useful for notes, warnings, or references.

---

## Lists

**Unordered:**
- Item one
- Item two
  - Sub-item A
  - Sub-item B
- Item three

**Ordered:**
1. First step
2. Second step
3. Third step

---

![Image description](img/img.png)
![Wordcraft](https://imgs.search.brave.com/on0VmKoid0tsGbJrghZNJ6U4-XvZ3oNUpwH71Mj5BbM/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pbWFn/ZXMuc3RlYW11c2Vy/Y29udGVudC5jb20v/dWdjLzI0OTkwMDQ1/OTMyNjk2NzUzNTEv/MzY3NDJCRTI3QTZF/M0E2Q0IyOUE2MTdB/MDg1MkYwOUY4MzBF/MEU0RC8_aW13PTEw/MCZpbWg9NTYmaW1h/PWZpdCZpbXBvbGlj/eT1MZXR0ZXJib3gm/aW1jb2xvcj0jMDAw/MDAwJmxldHRlcmJv/eD10cnVl)

## Code

```python
def fibonacci(n):
    """Generates the Fibonacci sequence up to n terms."""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print(list(fibonacci(10)))
```

```javascript
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await delay(100);
  console.log("Done");
})();
```

---

## Tables

| Parameter | Type | Description |
|-----------|------|-------------|
| `n` | `int` | Number of terms |
| `start` | `int` | Initial value |
| `step` | `float` | Increment between each element |

---

## LaTeX Formulas

### Inline

Euler's identity: $e^{i\pi} + 1 = 0$

Relativistic energy: $E = mc^2$, where $c \approx 3 \times 10^8 \, \text{m/s}$

### Block

**Fourier Transform:**

$$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(t)\, e^{-2\pi i \xi t} \, dt$$

**Schrödinger Equation:**

$$\hat{H}\,\psi = -\frac{\hbar^2}{2m}\nabla^2\psi + V(\mathbf{r})\,\psi = E\,\psi$$

**Normal Distribution:**

$$f(x \mid \mu, \sigma^2) = \frac{1}{\sqrt{2\pi\sigma^2}}\, \exp\!\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)$$

---

## Checklist

- [x] Works offline
- [x] Full Markdown support (local marked.js)
- [x] Inline and block LaTeX (local KaTeX)
- [x] Local KaTeX fonts (WOFF2)
- [ ] Color syntax highlighting (coming in the next version)
