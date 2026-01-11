#!/usr/bin/env python3
"""
Dependency Analyzer for Workflow Discovery

Analyzes package.json, requirements.txt, and other dependency files
to detect frameworks, libraries, and technologies for workflow recommendations.
"""

import os
import json
import re
from pathlib import Path
from typing import Dict, List, Set, Optional, Any
from dataclasses import dataclass

@dataclass
class DependencyInfo:
    """Information about detected dependencies."""
    name: str
    version: Optional[str] = None
    type: str = "unknown"  # dev, peer, production
    category: str = "unknown"  # frontend, backend, testing, build, etc.


class DependencyAnalyzer:
    """
    Analyzes dependency files to detect technologies and frameworks.
    """
    
    def __init__(self):
        self.framework_mappings = {
            # Frontend frameworks
            "react": {"category": "frontend", "type": "framework"},
            "vue": {"category": "frontend", "type": "framework"},
            "angular": {"category": "frontend", "type": "framework"},
            "svelte": {"category": "frontend", "type": "framework"},
            "next": {"category": "frontend", "type": "framework"},
            "nuxt": {"category": "frontend", "type": "framework"},
            
            # Backend frameworks
            "express": {"category": "backend", "type": "framework"},
            "fastapi": {"category": "backend", "type": "framework"},
            "django": {"category": "backend", "type": "framework"},
            "flask": {"category": "backend", "type": "framework"},
            "spring": {"category": "backend", "type": "framework"},
            "rails": {"category": "backend", "type": "framework"},
            
            # Testing frameworks
            "jest": {"category": "testing", "type": "framework"},
            "vitest": {"category": "testing", "type": "framework"},
            "pytest": {"category": "testing", "type": "framework"},
            "mocha": {"category": "testing", "type": "framework"},
            "cypress": {"category": "testing", "type": "framework"},
            "playwright": {"category": "testing", "type": "framework"},
            
            # Build tools
            "vite": {"category": "build", "type": "tool"},
            "webpack": {"category": "build", "type": "tool"},
            "rollup": {"category": "build", "type": "tool"},
            "parcel": {"category": "build", "type": "tool"},
            "esbuild": {"category": "build", "type": "tool"},
            
            # Database tools
            "prisma": {"category": "database", "type": "tool"},
            "typeorm": {"category": "database", "type": "tool"},
            "sqlalchemy": {"category": "database", "type": "tool"},
            "mongoose": {"category": "database", "type": "tool"},
            "sequelize": {"category": "database", "type": "tool"},
            
            # Documentation tools
            "storybook": {"category": "documentation", "type": "tool"},
            "docusaurus": {"category": "documentation", "type": "tool"},
            "vuepress": {"category": "documentation", "type": "tool"},
            "gitbook": {"category": "documentation", "type": "tool"},
        }
    
    def analyze_package_json(self, file_path: str) -> List[DependencyInfo]:
        """
        Analyze package.json file for dependencies.
        
        Args:
            file_path: Path to package.json file
            
        Returns:
            List of detected dependencies
        """
        dependencies = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
            
            # Analyze production dependencies
            for name, version in package_data.get('dependencies', {}).items():
                dep_info = self._create_dependency_info(name, version, "production")
                dependencies.append(dep_info)
            
            # Analyze dev dependencies
            for name, version in package_data.get('devDependencies', {}).items():
                dep_info = self._create_dependency_info(name, version, "dev")
                dependencies.append(dep_info)
            
            # Analyze peer dependencies
            for name, version in package_data.get('peerDependencies', {}).items():
                dep_info = self._create_dependency_info(name, version, "peer")
                dependencies.append(dep_info)
                
        except Exception as e:
            print(f"Error analyzing package.json: {e}")
        
        return dependencies
    
    def analyze_requirements_txt(self, file_path: str) -> List[DependencyInfo]:
        """
        Analyze requirements.txt file for Python dependencies.
        
        Args:
            file_path: Path to requirements.txt file
            
        Returns:
            List of detected dependencies
        """
        dependencies = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        # Parse dependency name and version
                        match = re.match(r'^([a-zA-Z0-9\-_]+)', line)
                        if match:
                            name = match.group(1)
                            version = line[len(name):].strip()
                            dep_info = self._create_dependency_info(name, version, "production")
                            dependencies.append(dep_info)
                            
        except Exception as e:
            print(f"Error analyzing requirements.txt: {e}")
        
        return dependencies
    
    def analyze_cargo_toml(self, file_path: str) -> List[DependencyInfo]:
        """
        Analyze Cargo.toml file for Rust dependencies.
        
        Args:
            file_path: Path to Cargo.toml file
            
        Returns:
            List of detected dependencies
        """
        dependencies = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Simple regex-based parsing (for basic dependency extraction)
            # In production, use a proper TOML parser
            dep_pattern = r'^(\w+)\s*=\s*["\']([^"\']+)["\']'
            
            for line in content.split('\n'):
                line = line.strip()
                match = re.match(dep_pattern, line)
                if match:
                    name = match.group(1)
                    version = match.group(2)
                    dep_info = self._create_dependency_info(name, version, "production")
                    dependencies.append(dep_info)
                    
        except Exception as e:
            print(f"Error analyzing Cargo.toml: {e}")
        
        return dependencies
    
    def analyze_go_mod(self, file_path: str) -> List[DependencyInfo]:
        """
        Analyze go.mod file for Go dependencies.
        
        Args:
            file_path: Path to go.mod file
            
        Returns:
            List of detected dependencies
        """
        dependencies = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Extract require statements
            require_pattern = r'require\s+(.+)\s+(.+)'
            
            for line in content.split('\n'):
                line = line.strip()
                match = re.match(require_pattern, line)
                if match:
                    name = match.group(1)
                    version = match.group(2)
                    dep_info = self._create_dependency_info(name, version, "production")
                    dependencies.append(dep_info)
                    
        except Exception as e:
            print(f"Error analyzing go.mod: {e}")
        
        return dependencies
    
    def get_framework_summary(self, dependencies: List[DependencyInfo]) -> Dict[str, Any]:
        """
        Generate a summary of detected frameworks and technologies.
        
        Args:
            dependencies: List of detected dependencies
            
        Returns:
            Dictionary containing framework summary
        """
        summary = {
            "frameworks": [],
            "categories": {},
            "total_dependencies": len(dependencies),
            "key_technologies": []
        }
        
        # Group by category
        for dep in dependencies:
            mapping = self.framework_mappings.get(dep.name.lower(), {})
            category = mapping.get("category", "unknown")
            dep_type = mapping.get("type", "library")
            
            if category not in summary["categories"]:
                summary["categories"][category] = {
                    "dependencies": [],
                    "frameworks": [],
                    "tools": []
                }
            
            summary["categories"][category]["dependencies"].append(dep.name)
            
            if dep_type == "framework":
                summary["categories"][category]["frameworks"].append(dep.name)
                if dep.name not in summary["frameworks"]:
                    summary["frameworks"].append(dep.name)
            elif dep_type == "tool":
                summary["categories"][category]["tools"].append(dep.name)
        
        # Identify key technologies (frameworks + essential tools)
        for category in summary["categories"]:
            summary["categories"][category]["frameworks"].sort()
            summary["categories"][category]["tools"].sort()
            summary["key_technologies"].extend(summary["categories"][category]["frameworks"])
            summary["key_technologies"].extend(summary["categories"][category]["tools"])
        
        return summary
    
    def _create_dependency_info(self, name: str, version: str, dep_type: str) -> DependencyInfo:
        """
        Create DependencyInfo object with framework mapping.
        
        Args:
            name: Dependency name
            version: Dependency version
            dep_type: Type of dependency (dev, peer, production)
            
        Returns:
            DependencyInfo object
        """
        mapping = self.framework_mappings.get(name.lower(), {})
        
        return DependencyInfo(
            name=name,
            version=version,
            type=dep_type,
            category=mapping.get("category", "unknown")
        )
    
    def analyze_project(self, project_path: str) -> Dict[str, Any]:
        """
        Analyze entire project for dependencies.
        
        Args:
            project_path: Path to project root
            
        Returns:
            Complete analysis results
        """
        all_dependencies = []
        analyzed_files = []
        
        project_path = Path(project_path)
        
        # Look for package.json
        package_json = project_path / "package.json"
        if package_json.exists():
            deps = self.analyze_package_json(str(package_json))
            all_dependencies.extend(deps)
            analyzed_files.append("package.json")
        
        # Look for requirements.txt
        requirements_txt = project_path / "requirements.txt"
        if requirements_txt.exists():
            deps = self.analyze_requirements_txt(str(requirements_txt))
            all_dependencies.extend(deps)
            analyzed_files.append("requirements.txt")
        
        # Look for Cargo.toml
        cargo_toml = project_path / "Cargo.toml"
        if cargo_toml.exists():
            deps = self.analyze_cargo_toml(str(cargo_toml))
            all_dependencies.extend(deps)
            analyzed_files.append("Cargo.toml")
        
        # Look for go.mod
        go_mod = project_path / "go.mod"
        if go_mod.exists():
            deps = self.analyze_go_mod(str(go_mod))
            all_dependencies.extend(deps)
            analyzed_files.append("go.mod")
        
        # Generate summary
        summary = self.get_framework_summary(all_dependencies)
        
        return {
            "analyzed_files": analyzed_files,
            "dependencies": all_dependencies,
            "summary": summary,
            "project_path": str(project_path)
        }


# Example usage
if __name__ == "__main__":
    analyzer = DependencyAnalyzer()
    
    # Analyze current directory
    results = analyzer.analyze_project(".")
    
    print("=== Dependency Analysis Results ===")
    print(f"Analyzed files: {results['analyzed_files']}")
    print(f"Total dependencies: {results['summary']['total_dependencies']}")
    print(f"Detected frameworks: {results['summary']['frameworks']}")
    print(f"Categories: {list(results['summary']['categories'].keys())}")
    
    for category, info in results['summary']['categories'].items():
        print(f"\n{category.upper()}:")
        if info['frameworks']:
            print(f"  Frameworks: {', '.join(info['frameworks'])}")
        if info['tools']:
            print(f"  Tools: {', '.join(info['tools'])}")
