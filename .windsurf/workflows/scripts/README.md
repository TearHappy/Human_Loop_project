# Workflow Discovery Scripts

This folder contains the analysis and detection scripts for the intelligent workflow discovery system.

## Overview

The workflow discovery system analyzes project structure, dependencies, and code patterns to recommend relevant workflows. It leverages Skill Seeker's powerful analysis tools and extends them for workflow detection.

## Scripts

### Core Analysis Scripts

#### `dependency_analyzer.py`
Analyzes package.json, requirements.txt, Cargo.toml, and other dependency files to detect frameworks, libraries, and technologies.

**Features:**
- Multi-language support (Node.js, Python, Rust, Go)
- Framework detection and categorization
- Dependency type classification (dev, peer, production)
- Technology stack summarization

**Usage:**
```python
from dependency_analyzer import DependencyAnalyzer

analyzer = DependencyAnalyzer()
results = analyzer.analyze_project("/path/to/project")
print(results['summary']['frameworks'])
```

#### `structure_analyzer.py`
Analyzes folder structure, file patterns, and project organization to detect architectural patterns.

**Features:**
- Folder pattern recognition (components/, api/, tests/, etc.)
- File extension analysis
- Architecture detection (frontend, backend, full-stack)
- Project type identification

**Usage:**
```python
from structure_analyzer import StructureAnalyzer

analyzer = StructureAnalyzer()
results = analyzer.analyze_project_structure("/path/to/project")
print(results['patterns']['architecture'])
```

#### `workflow_matcher.py`
Matches detected patterns and technologies to relevant workflows with confidence scoring.

**Features:**
- 15+ workflow templates with confidence scoring
- Multi-level trigger system (strong, medium, weak signals)
- Reasoning generation for suggestions
- Category-based filtering

**Usage:**
```python
from workflow_matcher import WorkflowMatcher

matcher = WorkflowMatcher()
suggestions = matcher.match_workflows(analysis_results)
for suggestion in suggestions:
    print(f"{suggestion.name}: {suggestion.confidence:.2f}")
```

### Utility Scripts

#### `utils.py`
Shared utility functions for file processing, validation, and data manipulation.

#### `constants.py`
Configuration constants and default values for analysis tools.

## Workflow Templates

The system includes 15+ pre-defined workflow templates:

### Frontend Workflows
- `component-library` - Component library creation and documentation
- `storybook-setup` - Storybook configuration for component development
- `frontend-testing` - Frontend testing suite setup

### Backend Workflows
- `api-documentation` - API documentation with OpenAPI/Swagger
- `database-schema` - Database schema analysis and documentation
- `database-migration` - Migration and seeding workflow

### Full-Stack Workflows
- `full-stack-documentation` - Comprehensive full-stack documentation

### Testing Workflows
- `test-coverage` - Test coverage reporting and improvement
- `api-testing` - Comprehensive API testing suite

### Documentation Workflows
- `documentation-generation` - Automated documentation generation
- `knowledge-base` - Searchable knowledge base creation

### Deployment Workflows
- `deployment-pipeline` - CI/CD pipeline setup
- `docker-setup` - Docker containerization

### Development Workflows
- `code-quality` - Code quality tools and standards
- `performance-optimization` - Performance analysis and optimization

## Integration with Workflow System

### 1. Workflow Discovery Integration
The scripts are integrated into the `/workflow-discovery` workflow:
```markdown
# Phase 2: Codebase Analysis
## Step 2.1: File Structure Analysis
Use structure_analyzer.py to examine folder patterns

## Step 2.2: Dependency Analysis  
Use dependency_analyzer.py to detect frameworks

## Step 2.3: Code Pattern Analysis
Use code_analyzer.py for deep code inspection

## Step 2.4: Workflow Matching
Use workflow_matcher.py to generate recommendations
```

### 2. Architect Workflow Integration
When users ask the LLM to create skills via the `/architect` workflow:
```markdown
# Phase 2: Deep Research
## Step 2.1: Technology Stack Analysis
- Use dependency_analyzer.py for framework detection
- Use structure_analyzer.py for architecture patterns

## Step 2.2: Code Analysis
- Use code_analyzer.py for signature extraction
- Use conflict_detector.py for pattern matching
```

### 3. Input Field Integration
The workflow discovery is integrated into the input field system:
- **Instant Analysis**: Quick file scanning for immediate suggestions
- **Progressive Analysis**: Background processing for comprehensive results
- **Real-time Updates**: Dynamic suggestion updates as analysis progresses

## Configuration

### Analysis Depth
Configure analysis depth based on project size:
```python
# For quick analysis (1-2 seconds)
analyzer.analyze_project_structure(project_path, max_depth=2)

# For comprehensive analysis (5-10 seconds)  
analyzer.analyze_project_structure(project_path, max_depth=4)
```

### Confidence Thresholds
Adjust confidence scoring weights:
```python
confidence_weights = {
    "strong_signal": 0.9,  # Direct framework + folder matches
    "medium_signal": 0.7,  # Framework OR folder matches  
    "weak_signal": 0.5,   # Partial matches
    "suggestion": 0.3      # General best practices
}
```

### Custom Workflow Templates
Add new workflow templates:
```python
new_workflow = {
    "category": "custom",
    "estimated_time": "20-40 minutes",
    "prerequisites": ["Custom requirement"],
    "triggers": {
        "strong": ["specific-pattern"],
        "medium": ["related-pattern"],
        "weak": ["general-pattern"]
    },
    "description": "Custom workflow description"
}
```

## Performance Optimization

### Caching Strategy
- **Project Fingerprint**: Cache file structure and dependency hash
- **Analysis Results**: Store workflow suggestions per project
- **Template Matching**: Cache pattern-to-workflow mappings

### Parallel Processing
- **File Analysis**: Parallel file scanning and parsing
- **Dependency Parsing**: Concurrent analysis of multiple dependency files
- **Pattern Matching**: Parallel workflow template evaluation

### Progressive Loading
- **Tier 1** (0-1s): Key file detection (package.json, README.md)
- **Tier 2** (1-3s): Folder structure analysis
- **Tier 3** (3-8s): Deep code pattern analysis
- **Tier 4** (8-15s): Comprehensive workflow matching

## Error Handling

### Graceful Degradation
- Continue analysis even if some files can't be accessed
- Provide partial results when full analysis fails
- Fallback to basic pattern detection for unsupported file types

### Validation
- Validate file permissions before analysis
- Check file size limits to prevent memory issues
- Verify dependency file formats before parsing

## Extending the System

### Adding New Analyzers
1. Create new analyzer class inheriting from base patterns
2. Implement required analysis methods
3. Add to workflow discovery pipeline
4. Update workflow templates with new triggers

### Adding New Workflow Categories
1. Define category in workflow_matcher.py
2. Create workflow templates for the category
3. Add detection patterns to analyzers
4. Update UI components for new category

### Integration with External Tools
- **MCP Tools**: Extend to work with new MCP servers
- **IDE Integration**: Add IDE-specific analysis hooks
- **CI/CD Integration**: Integrate with pipeline analysis

## Best Practices

### Performance
- Use appropriate analysis depth for project size
- Implement caching for repeated analyses
- Provide progressive loading for large projects

### Accuracy
- Validate confidence scoring with real projects
- Continuously improve trigger patterns
- Gather user feedback on suggestion quality

### Maintainability
- Keep analyzer scripts modular and focused
- Document workflow templates clearly
- Use consistent naming conventions

This workflow discovery system provides intelligent, context-aware recommendations that evolve with project needs and user requirements.
