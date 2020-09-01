# aws-howdy-partner-webhooks

To allow the CloudWatch Lambda to filter logs, you'll need the following IAM policy attached to it's role:
```
{
    "Version": "2012-10-17", 
    "Statement": [
        {
            "Action": [
                "logs:FilterLogEvents"
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ]
}
```
