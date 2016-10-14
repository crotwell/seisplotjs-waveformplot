module.exports = {
    "extends": "eslint:recommended",
    "installedESLint": true,
    "plugins": [
        "standard",
        "promise"
    ],
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
    },
    "rules": {
      "semi": ["error", "always"]
    }
};
