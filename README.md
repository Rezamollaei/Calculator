# Calculator

## 🌐 Web version

A user-friendly browser version of this calculator lives in [`docs/`](docs/).
Open `docs/index.html` in any browser — no install or build needed.

Features:
- Big, touch-friendly buttons that work on phones and desktops
- Keyboard support: digits, `+ - * / ^ ( ) ! %`, `Enter` / `=`, `Backspace`, `Esc`
  (shortcuts: `s` sin, `c` cos, `t` tan, `l` ln, `r` √, `p` π)
- Shows the expression you're building and highlights the selected operator
- Friendly error messages (e.g. "Can't divide by zero") instead of `inf`
- Calculation history (saved in your browser) — tap an entry to reuse its result
- `±`, `%`, decimal input, and clean results (`0.1 + 0.2 = 0.3`)
- **Scientific mode** (toggle with the *Scientific* button):
  - Parentheses and correct order of operations: `2 + 3 × 4 = 14`, `(2 + 3) × 4 = 20`
  - Trigonometry `sin`, `cos`, `tan` and inverses `sin⁻¹`, `cos⁻¹`, `tan⁻¹`, in degrees or radians (`Deg`/`Rad`)
  - Logarithms `ln`, `log`, and `eˣ`
  - Powers and roots: `x²`, `xʸ`, `√`, `∛`, `1/x`
  - Factorial `x!` and the constants `π` and `e`
  - Implied multiplication: `2π`, `3(4 + 1)`, `2sin(30)`
  - Live preview of the answer as you type
- Light and dark theme

To publish it with GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / `/docs`**.

## 💻 C++ console version


This is a basic calculator program in C++ that performs arithmetic operations (+, -, *, /) based on the user's input. Here's a breakdown of the code:

Key Components:
Input and Output:

The program prompts the user to enter an operator (+, -, *, or /).
Then, the user is asked to input two numbers (num1 and num2), which will be used in the arithmetic operation.
Switch Statement:

The switch statement checks the operator input (op) to decide which arithmetic operation to perform.
If the operator is +, it adds the two numbers.
If the operator is -, it subtracts the second number from the first.
If the operator is *, it multiplies the two numbers.
If the operator is /, it divides the first number by the second.
If the operator is invalid (not one of the four), it prints an error message indicating that the operator is not valid.

Formatting:

The program displays the result of the operation and then prints a closing line "****************************************".
Possible Improvements:
Input Validation:

There could be further input validation for the numbers (num1 and num2) to ensure that the user enters valid numeric values.
