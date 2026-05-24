# Testing Guide — Delivery Custom App

Complete guide for running, writing, and maintaining tests.

---

## 🧪 Backend Testing

### Running Tests

```bash
# All tests
pytest

# With coverage report
pytest --cov=src

# Single test file
pytest tests/test_auth.py

# Verbose output
pytest -v

# Stop on first failure
pytest -x

# Parallel execution
pytest -n auto
```

### Test Structure

```
tests/
├── test_auth.py          # Authentication endpoints
├── test_endpoints.py     # API endpoints
├── test_integration.py   # Integration tests
└── conftest.py           # Fixtures and configuration
```

### Writing Backend Tests

Use **pytest** and **pytest-asyncio** for async tests:

```python
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

@pytest.mark.asyncio
async def test_get_locals():
    response = client.get("/api/locals?business_id=uuid")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_auth_required():
    response = client.get("/api/dashboard/local/123")
    assert response.status_code == 401
```

### Test Database Setup

Tests use Supabase or local PostgreSQL. Configure in `.env.test`:

```env
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_KEY=test_anon_key
JWT_SECRET=test_secret
```

### Coverage Requirements

Target **70%+ code coverage**:

```bash
# View coverage report
pytest --cov=src --cov-report=html

# Open report
open htmlcov/index.html
```

---

## 🎨 Frontend Testing

### Running Tests

```bash
# All tests
npm run test

# Watch mode (re-run on file change)
npm run test:watch

# With coverage report
npm run test:coverage

# UI mode (interactive)
npm run test:ui
```

### Test Structure

```
src/
├── components/
│   └── Cart.test.jsx       # Component unit tests
├── hooks/
│   └── useAuth.test.js     # Hook unit tests
├── integration.test.js     # Integration tests
└── vitest.config.js        # Vitest configuration
```

### Writing Frontend Tests

Use **Vitest** and **React Testing Library**:

```javascript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Cart from '../components/Cart';

describe('Cart Component', () => {
  it('renders cart items', () => {
    const items = [{ id: 1, name: 'Café', price: 2.50 }];
    render(<Cart items={items} />);
    expect(screen.getByText('Café')).toBeInTheDocument();
  });

  it('removes item on delete click', () => {
    const onDelete = vitest.fn();
    render(<Cart items={[...]} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

### Testing Hooks

```javascript
import { renderHook, act } from '@testing-library/react';
import useLocals from '../hooks/useLocals';

it('fetches locals on mount', async () => {
  const { result } = renderHook(() => useLocals('business-id'));
  
  await act(async () => {
    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  
  expect(result.current.locals).toHaveLength(3);
});
```

### Testing Async Operations

```javascript
it('handles auth errors gracefully', async () => {
  render(<LoginForm />);
  
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'user@example.com' }
  });
  fireEvent.click(screen.getByRole('button', { name: /login/i }));
  
  await screen.findByText(/invalid credentials/i);
});
```

---

## ✅ Testing Best Practices

### Backend

1. **Test isolation** - Each test is independent
2. **Fixture reuse** - Use pytest fixtures for setup
3. **Mock external calls** - Mock Supabase, email services
4. **Test edge cases** - Empty lists, null values, permissions
5. **Clear test names** - `test_auth_required_for_dashboard`

### Frontend

1. **User-centric** - Test what users see/do, not implementation
2. **Avoid testing internals** - Don't test state directly
3. **Mock API calls** - Use `vi.mock()` for external requests
4. **Accessibility** - Use semantic queries: `getByRole`, `getByLabelText`
5. **Cleanup** - Use cleanup fixtures to reset state

---

## 📊 Continuous Testing

### Pre-commit Testing

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
npm run test:frontend
pytest --cov=src
```

### CI/CD Pipeline (Recommended)

Configure GitHub Actions (create `.github/workflows/test.yml`):

```yaml
name: Tests
on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: 3.11
      - run: pip install -r requirements.txt
      - run: pytest --cov=src

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test
```

---

## 🐛 Debugging Tests

### Backend

```bash
# Drop into debugger on failure
pytest --pdb tests/test_auth.py

# Print debug output
pytest -s tests/test_auth.py

# Show local variables on failure
pytest -l tests/test_auth.py
```

### Frontend

```bash
# Debug in browser
npm run test:ui

# Print console logs
console.log() works normally, check test output

# Inspect DOM
screen.debug() in test
```

---

## 📈 Coverage Goals

| Layer | Target | Current |
|-------|--------|---------|
| Backend | 70%+ | — |
| Frontend | 60%+ | — |
| Critical paths | 90%+ | — |

---

## 🔗 Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](../docs/CONTRIBUTING.md#testing)
