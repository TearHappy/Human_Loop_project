#!/usr/bin/env python3
"""
Structure Analyzer for Workflow Discovery

Analyzes folder structure, file patterns, and project organization
to detect architectural patterns and recommend workflows.
"""

import os
from pathlib import Path
from typing import Dict, List, Set, Optional, Any, Tuple
from dataclasses import dataclass
import json

@dataclass
class FileInfo:
    """Information about a file."""
    name: str
    path: str
    size: int
    extension: str
    category: str = "unknown"


@dataclass
class FolderInfo:
    """Information about a folder."""
    name: str
    path: str
    file_count: int
    subfolder_count: int
    category: str = "unknown"


class StructureAnalyzer:
    """
    Analyzes project structure to detect patterns and manual.
   wards workflow recommendations.
era.
    """
    
    def __init__(self):
        self.key_folders = {
            # Frontend patterns
            "components": {"category": "frontend", "type": "ui"},
            "src": {"category": "source", "type": "main"},
            "pages": {"category": "frontend", "type": "routing"},
            "views": {"category": "frontend", "type": "routing"},
            "hooks": {"category": "frontend", "type": "logic"},
            "store": {"category": "state", "type": "management"},
            "redux": {"category": "state", "type": "management"},
            "assets": {"category": "frontend", "type": "static"},
            "public": {"category": "frontend", "type": "static"},
            "styles": {"category": "frontend", "type": "styling"},
            
            # Backend patterns
            "api": {"category": "backend", "type": "routes"},
            "routes": {"category": "backend", "type": "routes"},
            "controllers": {"category": "backend", "type": "logic"},
            "services": {"category": "backend", "type": "logic"},
            "models": {"category": "backend", "type": "data"},
            "schemas": {"category": "backend", "type": "validation"},
            "middleware": {"category": "backend", "type": "processing"},
            "utils": {"category": "backend", "type": "helpers"},
            "lib": {"category": "backend", "type": "library"},
            
            # Testing patterns
            "tests": {"category": "testing", "type": "unit"},
            "__tests__": {"category": "testing", "type": "unit"},
            "test": {"category": "testing", "type": "unit"},
            "spec": {"category": "testing", "type": "unit"},
            "cypress": {"category": "testing", "type": "e2e"},
            "playwright": {"category": "testing", "type": "e2e"},
            
            # Documentation patterns
            "docs": {"category": "documentation", "type": "content"},
            "documentation": {"category": "documentation", "type": "content"},
            "md": {"category": "documentation", "type": "content"},
            
            # Database patterns
            "migrations": {"category": "database", "type": "schema"},
            "seeds": {"category": "database", "type": "data"},
            "sql": {"category": "database", "type": "queries"},
            
            # Configuration patterns
            "config": {"category": "configuration", "type": "settings"},
            "configs": {"category": "configuration", "type": "settings"},
            "settings": {"category": "configuration", "type": "settings"},
            
            # Deployment patterns
            "docker": {"category": "deployment", "type": "container"},
            "deploy": {"category": "deployment", "type": "deployment"},
            ".github": {"category": "deployment", "type": "ci-cd"},
            "scripts": {"category": "deployment", "type": "automation"},
        }
        
        self.key_files = {
            # Configuration files
            "package.json": {"category": "configuration", "type": "dependencies"},
            "requirements.txt": {"category": "configuration", "type": "dependencies"},
            "Cargo.toml": {"category": "configuration", "type": "dependencies"},
            "go.mod": {"category": "configuration", "type": "dependencies"},
            "tsconfig.json": {"category": "configuration", "type": "typescript"},
            "jsconfig.json": {"category": "configuration", "type": "javascript"},
            "vite.config.ts": {"category": "configuration", "type": "build"},
            "vite.config.js": {"category": "configuration", "type": "build"},
            "webpack.config.js": {"category": "configuration", "type": "build"},
            "rollup.config.js": {"category": "configuration", "type": "build"},
            "eslint.config.js": {"category": "configuration", "type": "linting"},
            ".eslintrc.json": {"category": "configuration", "type": "linting"},
            "prettier.config.js": {"category": "configuration", "type": "formatting"},
            ".prettierrc": {"category": "configuration", "type": "formatting"},
            
            # Documentation files
            "README.md": {"category": "documentation", "type": "readme"},
            "CHANGELOG.md": {"category": "documentation", "type": "changelog"},
            "CONTRIBUTING.md": {"category": "documentation", "type": "contributing"},
            "LICENSE": {"category": "documentation", "type": "license"},
            "LICENSE.md": {"category": "documentation", "type": "license"},
            
            # Database files
            "schema.sql": {"category": "database", "type": "schema"},
            "database.sql": {"category": "database", "type": "schema"},
            "prisma.schema": {"category": "database", "type": "orm"},
            "Dockerfile": {"category": "deployment", "type": "container"},
            "docker-compose.yml": {"category": "deployment", "type": "container"},
            "docker-compose.yaml": {"category": "deployment", "type": "container"},
            
            # Testing files
            "jest.config.js": {"category": "testing", "type": "config"},
            "vitest.config.ts": {"category": "testing", "type": "config"},
            "pytest.ini": {"category": "testing", "type": "config"},
            "cypress.config.ts": {"category": "testing", "type": "config"},
            "playwright.config.ts": {"category": "testing", "type": "config"},
        }
        
        self.file_extensions = {
            # Frontend
            ".jsx": {"category": "frontend", "type": "component"},
            ".tsx": {"category": "frontend", "type": "component"},
            ".svelte": {"category": "frontend", "type": "component"},
            
            # Backend
            ".py": {"category": "backend", "type": "source"},
            ".js": {"category": "backend", "type": "source"},
            ".ts": {"category": "backend", "type": "source"},
            ".go": {"category": "backend", "type": "source"},
            ".rs": {"category": "backend", "type": "source"},
            ".java": {"category": "backend", "type": "source"},
            ".php": {"category": "backend", "type": "source"},
            ".rb": {"category": "backend", "type": "source"},
            ".cs": {"category": "backend", "type": "source"},
            
            # Database
            ".sql": {"category": "database", "type": "query"},
            ".prisma": {"category": "database", "type": "orm"},
            
            # Documentation
            ".md": {"category": "documentation", "type": "content"},
            ".rst": {"category": "documentation", "type": "content"},
            ".txt": {"category": "documentation", "type": "content"},
            
            # Configuration
            ".json": {"category": "configuration", "type": "config"},
            ".yaml": {"category": "configuration", "type": "config"},
            ".yml": {"category": "configuration", "type": "config"},
            ".toml": {"category": "configuration", "type": "config"},
            ".ini": {"category": "configuration", "type": "config"},
            ".env": {"category": "configuration", "type": "environment"},
            
            # Styling
            ".css": {"category": "frontend", "type": "style"},
            ".scss": {"category": "frontend", "type": "style"},
            ".sass": {"category": "frontend", "type": "style"},
            ".less": {"category": "frontend", "type": "style"},
            ".styl": {"category": "frontend", "type": "style"},
        }
    
    def analyze_project_structure(self, project_path: str, max_depth: int = 3) -> Dict[str, Any]:
        """
        Analyze project structure and detect patterns.
        
        Args:
            project_path: Path to project root
            max_depth: Maximum depth to analyze
            
        Returns:
            Dictionary containing structure analysis
        """
        project_path = Path(project_path)
        
        if not project_path.exists():
            return {"error": "Project path does not exist"}
        
        # Analyze folders
        folders = self._analyze_folders(project_path, max_depth)
        
        # Analyze files
        files = self._analyze_files(project_path, max_depth)
        
        # Detect patterns
        patterns = self._detect_patterns(folders, files)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(patterns)
        
        return {
            "project_path": str(project_path),
            "folders": folders,
            "files": files,
            "patterns": patterns,
            "recommendations": recommendations,
            "summary": self._create_summary(folders, files, patterns)
        }
    
    def _analyze_folders(self, project_path: Path, max_depth: int) -> List[FolderInfo]:
        """Analyze folder structure."""
        folders = []
        
        for root, dirs, files in os.walk(project_path):
            # Calculate depth
            depth = len(Path(root).relative_to(project_path).parts)
            
            if depth > max_depth:
                continue
            
            for dir_name in dirs:
                dir_path = Path(root) / dir_name
                
                # Count files and subfolders
                file_count = len([f for f in os.listdir(dir_path) if Path(dir_path / f).is_file()])
                subfolder_count = len([d for d in os.listdir(dir_path) if Path(dir_path / d).is_dir()])
                
                # Categorize folder
                mapping = self.key_folders.get(dir_name.lower(), {})
                category = mapping.get("category", "unknown")
                
                folder_info = FolderInfo(
                    name=dir_name,
                    path=str(dir_path),
                    file_count=file_count,
                    subfolder_count=subfolder_count,
                    category=category
                )
                
                folders.append(folder_info)
        
        return folders
    
    def _analyze_files(self, project_path: Path, max_depth: int) -> List[FileInfo]:
        """Analyze files in project."""
        files = []
        
        for root, dirs, file_names in os.walk(project_path):
            # Calculate depth
            depth = len(Path(root).relative_to(project_path).parts)
            
            if depth > max_depth:
                continue
            
            for file_name in file_names:
                file_path = Path(root) / file_name
                
                try:
                    # Get file info
                    stat = file_path.stat()
                    extension = file_path.suffix.lower()
                    
                    # Categorize file
                    # Check key files first
                    if file_name in self.key_files:
                        category = self.key_files[file_name]["category"]
                    # Then check extensions
                    elif extension in self.file_extensions:
                        category = self.file_extensions[extension]["category"]
                    else:
                        category = "unknown"
                    
                    file_info = FileInfo(
                        name=file_name,
                        path=str(file_path),
                        size=stat.st_size,
                        extension=extension,
                        category=category
                    )
                    
                    files.append(file_info)
                    
                except (OSError, PermissionError):
                    # Skip files that can't be accessed
                    continue
        
        return files
    
    def _detect_patterns(self, folders: List[FolderInfo], files: List[FileInfo]) -> Dict[str, Any]:
        """Detect architectural patterns from structure."""
        patterns = {
            "architecture": "unknown",
            "frameworks": [],
            "project_types": [],
            "key_patterns": []
        }
        
        # Group folders by category
        folder_categories = {}
        for folder in folders:
            if folder.category not in folder_categories:
                folder_categories[folder.category] = []
            folder_categories[folder.category].append(folder.name)
        
        # Group files by category
        file_categories = {}
        for file in files:
            if file.category not in file_categories:
                file_categories[file.category] = []
            file_categories[file.category].append(file.name)
        
        # Detect architecture patterns
        if "frontend" in folder_categories and "backend" in folder_categories:
            patterns["architecture"] = "full-stack"
        elif "frontend" in folder_categories:
            patterns["architecture"] = "frontend"
        elif "backend" in folder_categories:
            patterns["architecture"] = "backend"
        
        # Detect specific frameworks
        if "components" in folder_categories.get("frontend", []):
            patterns["frameworks"].append("component-based")
        
        if "api" in folder_categories.get("backend", []):
            patterns["frameworks"].append("api-driven")
        
        if "tests" in folder_categories or "__tests__" in folder_categories:
            patterns["frameworks"].append("test-driven")
        
        # Detect project types
        if "docs" in folder_categories:
            patterns["project_types"].append("documentation-heavy")
        
        if "migrations" in folder_categories:
            patterns["project_types"].append("database-driven")
        
        if ".github" in folder_categories:
            patterns["project_types"].append("ci-cd-enabled")
        
        # Detect key patterns
        if "package.json" in file_categories.get("configuration", []):
            patterns["key_patterns"].append("nodejs-project")
        
        if "requirements.txt" in file_categories.get("configuration", []):
            patterns["key_patterns"].append("python-project")
        
        if "Cargo.toml" in file_categories.get("configuration", []):
            patterns["key_patterns"].append("rust-project")
        
        if "go.mod" in file_categories.get("configuration", []):
            patterns["key_patterns"].append("go-project")
        
        return patterns
    
    def _generate_recommendations(self, patterns: Dict[str, Any]) -> List[str]:
        """Generate workflow recommendations based on patterns."""
        recommendations = []
        
        architecture = patterns.get("architecture", "unknown")
        frameworks = patterns.get("frameworks", [])
        project_types = patterns.get("project_types", [])
        key_patterns = patterns.get("key_patterns", [])
        
        # Architecture-based recommendations
        if architecture == "full-stack":
            recommendations.append("full-stack-documentation")
            recommendations.append("api-documentation")
            recommendations.append("component-library")
        elif architecture == "frontend":
            recommendations.append("component-library")
            recommendations.append("frontend-testing")
        elif architecture == "backend":
            recommendations.append("api-documentation")
            recommendations.append("database-schema")
        
        # Framework-based recommendations
        if "component-based" in frameworks:
            recommendations.append("storybook-setup")
            recommendations.append("component-testing")
        
        if "api-driven" in frameworks:
            recommendations.append("openapi-spec")
            recommendations.append("api-testing")
        
        if "test-driven" in frameworks:
            recommendations.append("test-coverage")
            recommendations.append("ci-testing")
        
        # Project type recommendations
        if "documentation-heavy" in project_types:
            recommendations.append("documentation-generation")
            recommendations.append("knowledge-base")
        
        if "database-driven" in project_types:
            recommendations.append("database-migration")
            recommendations.append("data-validation")
        
        if "ci-cd-enabled" in project_types:
            recommendations.append("deployment-pipeline")
            recommendations.append("automation-workflow")
        
        # Remove duplicates and return
        return list(set(recommendations))
    
    def _create_summary(self, folders: List[FolderInfo], files: List[FileInfo], patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Create summary of analysis."""
        folder_categories = {}
        for folder in folders:
            if folder.category not in folder_categories:
                folder_categories[folder.category] = 0
            folder_categories[folder.category] += 1
        
        file_categories = {}
        for file in files:
            if file.category not in file_categories:
                file_categories[file.category] = 0
            file_categories[file.category] += 1
        
        return {
            "total_folders": len(folders),
            "total_files": len(files),
            "folder_categories": folder_categories,
            "file_categories": file_categories,
            "detected_architecture": patterns.get("architecture", "unknown"),
            "detected_frameworks": patterns.get("frameworks", []),
            "detected_project_types": patterns.get("project_types", [])
        }


# Example usage
if __name__ == "__main__":
    analyzer = StructureAnalyzer()
    
    # Analyze current directory
    results = analyzer.analyze_project(".", max_depth=2)
    
    print("=== Structure Analysis Results ===")
    print(f"Total folders: {results['summary']['total_folders']}")
    print(f"Total files: {results['summary']['total_files']}")
    print(f"Architecture: {results['summary']['detected_architecture']}")
    print(f"Frameworks: {results['summary']['detected_frameworks']}")
    print(f"Project types: {results['summary']['detected_project_types']}")
    print(f"Recommendations: {results['recommendations']}")
    
    print("\n=== Folder Categories ===")
    for category, count in results['summary']['folder_categories'].items():
        print(f"{category}: {count}")
    
    print("\n=== File Categories ===")
    for category, count in results['summary']['file_categories'].items():
        print(f"{category}: {count}")
