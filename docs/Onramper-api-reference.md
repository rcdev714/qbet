Get Currencies

# Get Currencies

Retruns a complete list of supported fiat and cryptocurrency options, based on
the specified transaction type and country.

🛠️ Please Use [https://api-stg.onramper.com/](https://api-stg.onramper.com/) For
Test Environments

# OpenAPI definition

```json
{
    "openapi": "3.0.0",
    "info": {
        "title": "Onramper API Collection V2",
        "version": "1.0.0"
    },
    "servers": [
        {
            "url": "https://api.onramper.com"
        },
        {
            "url": "https://api-stg.onramper.com"
        }
    ],
    "tags": [
        {
            "name": "Supported"
        }
    ],
    "paths": {
        "/supported": {
            "get": {
                "tags": [
                    "Supported"
                ],
                "summary": "Get Currencies",
                "description": "Retruns a complete list of supported fiat and cryptocurrency options, based on the specified transaction type and country.\n\n🛠️ Please Use [https://api-stg.onramper.com/](https://api-stg.onramper.com/) For Test Environments",
                "parameters": [
                    {
                        "name": "Authorization",
                        "in": "header",
                        "schema": {
                            "type": "string"
                        },
                        "example": "pk_prod_01HETEQF46GSK6BS5JWKDF31BT"
                    },
                    {
                        "name": "type",
                        "in": "query",
                        "schema": {
                            "type": "string"
                        },
                        "description": "Transaction type (buy/sell). Default: buy",
                        "example": "buy"
                    },
                    {
                        "name": "country",
                        "in": "query",
                        "schema": {
                            "type": "string"
                        },
                        "description": "Country for the filtration (If not specified, the country will be automatically determined based on the IP address from which the request originates.)",
                        "example": "us"
                    },
                    {
                        "name": "subdivision",
                        "in": "query",
                        "schema": {
                            "type": "string"
                        },
                        "description": "Subdivision for the filtration (If not specified, the subdivision will be automatically determined based on the IP address from which the request originates.)",
                        "example": "us-ny"
                    },
                    {
                        "name": "skipCountryCheck",
                        "in": "query",
                        "schema": {
                            "type": "boolean"
                        },
                        "description": "Whether the country-based filters should be skipped, allowing to fetch all assets",
                        "example": "false"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "headers": {
                            "Content-Type": {
                                "schema": {
                                    "type": "string",
                                    "example": "application/json"
                                }
                            }
                        },
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object"
                                },
                                "example": {
                                    "message": {
                                        "crypto": [
                                            {
                                                "id": "aave_ethereum",
                                                "code": "AAVE",
                                                "name": "Aave",
                                                "symbol": "aave",
                                                "network": "ethereum",
                                                "decimals": 18,
                                                "address": "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
                                                "chainId": 1,
                                                "icon": "https://cdn.onramper.com/icons/crypto/aave_ethereum.png",
                                                "networkDisplayName": "Ethereum"
                                            }
                                        ],
                                        "fiat": [
                                            {
                                                "id": "eur",
                                                "code": "EUR",
                                                "name": "Euro Member Countries",
                                                "symbol": "€",
                                                "icon": "https://cdn.onramper.com/icons/tokens/eur.svg"
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    "401": {
                        "description": "Unauthorized",
                        "headers": {
                            "Content-Type": {
                                "schema": {
                                    "type": "string",
                                    "example": "application/json"
                                }
                            }
                        },
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object"
                                },
                                "example": {
                                    "message": "Unauthorized"
                                }
                            }
                        }
                    },
                    "403": {
                        "description": "Forbidden",
                        "headers": {
                            "Content-Type": {
                                "schema": {
                                    "type": "string",
                                    "example": "application/json"
                                }
                            }
                        },
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object"
                                },
                                "example": {
                                    "message": "Forbidden"
                                }
                            }
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "headers": {
                            "Content-Type": {
                                "schema": {
                                    "type": "string",
                                    "example": "application/json"
                                }
                            }
                        },
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object"
                                },
                                "example": {
                                    "message": "Internal server error occurred. Please try again later."
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
```
