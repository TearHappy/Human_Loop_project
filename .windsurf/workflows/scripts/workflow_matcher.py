#!/usr/bin/env python3
"""
Workflow Matcher for Workflow Discovery

Matches detected patterns and technologies to relevant workflows
with confidence scoring and recommendations.
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import json
from pathlib import Path

@dataclass
class WorkflowSuggestion:
    """A workflow suggestion with confidence and reasoning."""
    name: str
    confidence: float
    reasoning: str
    category: str
    estimated_time: str
    prerequisites: List[str]
    triggers: List[str]


class WorkflowMatcher:
    """
    Matches detected patterns to workflow suggestions.
    """
    
    def __init__(self):
        self.workflow_templates = self._load_workflow_templates()
        self.confidence_weights = {
            "strong_signal": 0.9,  # Direct framework + folder matches
            "medium_signal": 0.7,  # Framework OR folder matches
            "weak_signal": 0.5,   # Partial matches
            "suggestion": 0.3      # General best practices
        }
    
    def _load_workflow_templates(self) -> Dict[str, Any]:
        """Load workflow templates and their requirements."""
        return {
            # Frontend workflows
            "component-library": {
                "category": "frontend",
                "estimated_time": "15-30 minutes",
                "prerequisites": ["React/Vue/Angular", "components folder"],
                "triggers": {
                    "strong": ["react", "vue", "angular", "components/"],
                    "medium": ["jsx", "tsx", "vue", "svelte"],
                    "weak": ["src/", "lib/"]
                },
                "description": "Create comprehensive component library with documentation and testing"
            },
            
            "storybook-setup": {
                "category": "frontend",
                "estimated_time": "10-20 minutes",
                "prerequisites": ["Component library", "React/Vue/Angular"],
                "triggers": {
                    "strong": ["components/", "storybook"],
                    "medium": ["react", "vue", "angular"],
                    "weak": ["ui components", "design system"]
                },
                "description": "Set up Storybook for component development and documentation"
            },
            
            "frontend-testing": {
                "category": "testing",
                "estimated_time": "20-40 minutes",
                "prerequisites": ["Frontend framework", "Test files"],
                "triggers": {
                    "strong": ["jest", "vitest", "cypress", "playwright"],
                    "medium": ["tests/", "__tests__", "spec/"],
                    "weak": ["test", "spec"]
                },
                "description": "Set up comprehensive frontend testing suite"
            },
            
            # Backend workflows
            "api-documentation": {
                "category": "backend",
                "estimated_time": "20-45 minutes",
                "prerequisites": ["API framework", "Route definitions"],
                "triggers": {
                    "strong": ["express", "fastapi", "django", "api/", "routes/"],
                    "medium": ["rest", "graphql", "api"],
                    "weak": ["server", "backend"]
                },
                "description": "Generate comprehensive API documentation with OpenAPI/Swagger"
            },
            
            "database-schema": {
                "category": "database",
                "estimated_time": "30-60 minutes",
                "prerequisites": ["Database ORM", "Model definitions"],
                "triggers": {
                    "strong": ["prisma", "typeorm", "sqlalchemy", "models/", "schemas/"],
                    "medium": ["database", "orm", "models"],
                    "weak": ["data", "storage"]
                },
                "description": "Analyze and document database schema with relationships"
            },
            
            "database-migration": {
                "category": "database",
                "estimated_time": "15-30 minutes",
                "prerequisites": ["Database setup", "Migration files"],
                "triggers": {
                    "strong": ["migrations/", "seeds/", "prisma"],
                    "medium": ["database", "sql", "schema"],
                    "weak": ["data", "storage"]
                },
                "description": "Set up database migration and seeding workflow"
            },
            
            # Full-stack workflows
            "full-stack-documentation": {
                "category": "documentation",
                "estimated_time": "45-90 minutes",
                "prerequisites": ["Frontend + Backend", "API endpoints"],
                "triggers": {
                    "strong": ["react", "express", "api/", "components/"],
                    "medium": ["frontend", "backend", "full-stack"],
                    "weak": ["web", "application"]
                },
                "description": "Create comprehensive documentation for full-stack application"
            },
            
            # Testing workflows
            "test-coverage": {
                "category": "testing",
                "estimated_time": "25-45 minutes",
                "prerequisites": ["Test framework", "Source code"],
                "triggers": {
                    "strong": ["jest", "vitest", "pytest", "coverage"],
                    "medium": ["tests/", "__tests__", "testing"],
                    "weak": ["test", "spec"]
                },
                "description": "Set up test coverage reporting and improve test coverage"
            },
            
            "api-testing": {
                "category": "testing",
                "estimated_time": "20-35 minutes",
                "prerequisites": ["API endpoints", "Testing framework"],
                "triggers": {
                    "strong": ["express", "fastapi", "cypress", "playwright"],
                    "medium": ["api/", "routes/", "testing"],
                    "weak": ["api", "test"]
                },
                "description": "Set up comprehensive API testing suite"
            },
            
            # Documentation workflows
            "documentation-generation": {
                "category": "documentation",
                "estimated_time": "30-60 minutes",
                "prerequisites": ["Source code", "README files"],
                "triggers": {
                    "strong": ["readme.md", "docs/", "documentation"],
                    "medium": [".md files", "comments", "docstrings"],
                    "weak": ["docs", "documentation"]
                },
                "description": "Generate comprehensive documentation from source code and existing docs"
            },
            
            "knowledge-base": {
                "category": "documentation",
                "estimated_time": "45-75 minutes",
                "prerequisites": ["Documentation files", "Project structure"],
                "triggers": {
                    "strong": ["docs/", "documentation", "readme.md"],
                    "medium": [".md files", "wiki", "knowledge"],
                    "weak": ["docs", "information"]
                },
                "description": "Create searchable knowledge base from project documentation"
            },
            
            # Deployment workflows
            "deployment-pipeline": {
                "category": "deployment",
                "estimated_time": "30-60 minutes",
                "prerequisites": ["Project structure", "CI/CD setup"],
                "triggers": {
                    "strong": [".github/", "dockerfile", "ci-cd"],
                    "medium": ["deploy", "pipeline", "automation"],
                    "weak": ["production", "release"]
                },
                "description": "Set up automated deployment pipeline with CI/CD"
            },
            
            "docker-setup": {
                "category": "deployment",
                "estimated_time": "15-30 minutes",
                "prerequisites": ["Application code", "Configuration"],
                "triggers": {
                    "strong": ["dockerfile", "docker-compose"],
                    "medium": ["container", "deployment"],
                    "weak": ["docker", "containerization"]
                },
                "description": "Set up Docker containerization for application"
            },
            
            # Development workflows
            "code-quality": {
                "category": "development",
                "estimated_time": "20-40 minutes",
                "prerequisites": ["Source code", "Linting tools"],
                "triggers": {
                    "strong": ["eslint", "prettier", "linting"],
                    "medium": ["code quality", "formatting"],
                    "weak": ["code", "quality"]
                },
                "description": "Set up code quality tools and formatting standards"
            },
            
            "performance-optimization": {
                "category": "development",
                "estimated_time": "30-60 minutes",
                "prerequisites": ["Application code", "Performance issues"],
                "triggers": {
                    "strong": ["performance", "optimization", "speed"],
                    "medium": ["slow", "lag", "optimization"],
                    "weak": ["performance", "improvement"]
                },
                "description": "Analyze and optimize application performance"
            }
        }
    
    def match_workflows(self, analysis_results: Dict[str, Any]) -> List[WorkflowSuggestion]:
        """
        Match analysis results to workflow suggestions.
        
        Args:
            analysis_results: Results from dependency and structure analysis
            
        Returns:
            List of workflow suggestions with confidence scores
        """
        suggestions = []
        
        # Extract information from analysis results
        dependencies = analysis_results.get("dependencies", [])
        structure = analysis_results.get("structure", {})
        patterns = structure.get("patterns", {})
        
        # Create a list of detected technologies and patterns
        detected_items = self._extract_detected_items(dependencies, patterns)
        
        # Match against workflow templates
        for workflow_name, template in self.workflow_templates.items():
            suggestion = self._calculate_workflow_confidence(workflow_name, template, detected_items)
            if suggestion.confidence >= 0.3:  # Minimum confidence threshold
                suggestions.append(suggestion)
        
        # Sort by confidence
        suggestions.sort(key=lambda x: x.confidence, reverse=True)
        
        return suggestions
    
    def _extract_detected_items(self, dependencies: List[Any], patterns: Dict[str, Any]) -> List[str]:
        """Extract detected technologies and patterns into a flat list."""
        detected_items = []
        
        # Extract from dependencies
        for dep in dependencies:
            detected_items.append(dep.name.lower())
            if hasattr(dep, 'category'):
                detected_items.append(dep.category.lower())
        
        # Extract from patterns
        detected_items.extend(patterns.get("frameworks", []))
        detected_items.extend(patterns.get("project_types", []))
        detected_items.extend(patterns.get("key_patterns", []))
        
        # Add architecture
        architecture = patterns.get("architecture", "")
        if architecture and architecture != "unknown":
            detected_items.append(architecture)
        
        return [item.lower() for item in detected_items]
    
    def _calculate_workflow_confidence(self, workflow_name: str, template: Dict[str, Any], detected_items: List[str]) -> WorkflowSuggestion:
        """Calculate confidence score for a workflow."""
        triggers = template.get("triggers", {})
        
        # Count matches at different signal levels
        strong_matches = len(set(triggers.get("strong", [])) & set(detected_items))
        medium_matches = len(set(triggers.get("medium", [])) & set(detected_items))
        weak_matches = len(set(triggers.get("weak", [])) & set(detected_items))
        
        # Calculate weighted confidence
        confidence = (
            strong_matches * self.confidence_weights["strong_signal"] +
            medium_matches * self.confidence_weights["medium_signal"] +
            weak_matches * self.confidence_weights["weak_signal"]
        )
        
        # Cap at 1.0
        confidence = min(confidence, 1.0)
        
        # Generate reasoning
        reasoning = self._generate_reasoning(strong_matches, medium_matches, weak_matches, triggers, detected_items)
        
        # Get matching triggers
        matching_triggers = []
        for level in ["strong", "medium", "weak"]:
            for trigger in triggers.get(level, []):
                if trigger.lower() in detected_items:
                    matching_triggers.append(trigger)
        
        return WorkflowSuggestion(
            name=workflow_name,
            confidence=confidence,
            reasoning=reasoning,
            category=template.get("category", "general"),
            estimated_time=template.get("estimated_time", "30-60 minutes"),
            prerequisites=template.get("prerequisites", []),
            triggers=matching_triggers
        )
    
    def _generate_reasoning(self, strong_matches: int, medium_matches: int, weak_matches: int, triggers: Dict[str, List[str]], detected_items: List[str]) -> str:
        """Generate human-readable reasoning for the workflow suggestion."""
        reasoning_parts = []
        
        if strong_matches > 0:
            strong_items = [item for item in triggers.get("strong", []) if item.lower() in detected_items]
            reasoning_parts.append(f"Strong indicators: {', '.join(strong_items)}")
        
        if medium_matches > 0:
            medium_items = [item for item in triggers.get("medium", []) if item.lower() in detected_items]
            reasoning_parts.append(f"Supporting indicators: {', '.join(medium_items)}")
        
        if weak_matches > 0:
            weak_items = [item for item in triggers.get("weak", []) if item.lower() in detected_items]
            reasoning_parts.append(f"Additional indicators: {', '.join(weak_items)}")
        
        if not reasoning_parts:
            return "General recommendation based on project structure"
        
        return " | ".join(reasoning_parts)
    
    def get_workflow_categories(self) -> Dict[str, List[str]]:
        """Get all workflow categories and their workflows."""
        categories = {}
        
        for workflow_name, template in self.workflow_templates.items():
            category = template.get("category", "general")
            if category not in categories:
                categories[category] = []
            categories[category].append(workflow_name)
        
        return categories
    
    def get_workflow_details(self, workflow_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific workflow."""
        return self.workflow_templates.get(workflow_name)
    
    def filter_suggestions(self, suggestions: List[WorkflowSuggestion], category: Optional[str] = None, min_confidence: float = 0.0) -> List[WorkflowSuggestion]:
        """Filter workflow suggestions by category and confidence."""
        filtered = suggestions
        
        if category:
            filtered = [s for s in filtered if s.category == category]
        
        if min_confidence > 0:
            filtered = [s for s in filtered if s.confidence >= min_confidence]
        
        return filtered


# Example usage
if __name__ == "__main__":
    matcher = WorkflowMatcher()
    
    # Example analysis results
    example_analysis = {
        "dependencies": [
            {"name": "react", "category": "frontend"},
            {"name": "express", "category": "backend"},
            {"name": "jest", "category": "testing"}
        ],
        "structure": {
            "patterns": {
                "architecture": "full-stack",
                "frameworks": ["component-based", "api-driven", "test-driven"],
                "project_types": ["ci-cd-enabled"]
            }
        }
    }
    
    # Get workflow suggestions
    suggestions = matcher.match_workflows(example_analysis)
    
    print("=== Workflow Suggestions ===")
    for suggestion in suggestions:
        print(f"\n{suggestion.name.upper()}:")
        print(f"  Confidence: {suggestion.confidence:.2f}")
        print(f"  Category: {suggestion.category}")
        print(f"  Estimated Time: {suggestion.estimated_time}")
        print(f"  Reasoning: {suggestion.reasoning}")
        print(f"  Prerequisites: {', '.join(suggestion.prerequisites)}")
        print(f"  Triggers: {', '.join(suggestion.triggers)}")
    
    print(f"\n=== Workflow Categories ===")
    categories = matcher.get_workflow_categories()
    for category, workflows in categories.items():
        print(f"{category}: {', '.join(workflows)}")
