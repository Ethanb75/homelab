# test the api

```sh
curl http://192.168.1.xxx:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "spark-x2.5-4b",
    "messages": [
      {
        "role": "user",
        "content": "Write a small Python function that checks whether a number is prime."
      }
    ],
    "max_tokens": 256
  }'
```
