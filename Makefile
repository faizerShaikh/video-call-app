.PHONY: help build up down restart logs clean test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

build: ## Build Docker images
	docker-compose build

build-prod: ## Build production Docker images
	docker-compose -f docker-compose.prod.yml build

up: ## Start containers
	docker-compose up -d

up-prod: ## Start production containers
	docker-compose -f docker-compose.prod.yml up -d

down: ## Stop containers
	docker-compose down

down-prod: ## Stop production containers
	docker-compose -f docker-compose.prod.yml down

restart: ## Restart containers
	docker-compose restart

restart-prod: ## Restart production containers
	docker-compose -f docker-compose.prod.yml restart

logs: ## View logs
	docker-compose logs -f

logs-prod: ## View production logs
	docker-compose -f docker-compose.prod.yml logs -f

logs-server: ## View server logs
	docker-compose logs -f server

logs-client: ## View client logs
	docker-compose logs -f client

ps: ## Show running containers
	docker-compose ps

ps-prod: ## Show production containers
	docker-compose -f docker-compose.prod.yml ps

clean: ## Remove containers, networks, and volumes
	docker-compose down -v
	docker system prune -f

clean-prod: ## Remove production containers, networks, and volumes
	docker-compose -f docker-compose.prod.yml down -v

test: ## Test server health
	@echo "Testing server health..."
	@curl -s http://localhost:3001/health | jq . || curl -s http://localhost:3001/health

test-client: ## Test client
	@echo "Testing client..."
	@curl -s http://localhost/ | head -n 5

update: ## Update and rebuild containers
	git pull
	docker-compose build
	docker-compose up -d

update-prod: ## Update and rebuild production containers
	git pull
	docker-compose -f docker-compose.prod.yml build
	docker-compose -f docker-compose.prod.yml up -d

shell-server: ## Open shell in server container
	docker-compose exec server sh

shell-client: ## Open shell in client container
	docker-compose exec client sh

stats: ## Show container resource usage
	docker stats
