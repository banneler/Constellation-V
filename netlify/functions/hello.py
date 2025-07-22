import json

def handler(event, context):
    print("Hello function invoked")
    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Hello from your Netlify function!"})
    }
