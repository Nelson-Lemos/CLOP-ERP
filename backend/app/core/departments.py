"""Fonte única dos departamentos oficiais da CLOP e da sua ordem de apresentação."""

DEPARTMENTS: list[tuple[str, str]] = [
    ("Tecnologia", "Desenvolvimento e infraestrutura tecnológica"),
    ("Operação", "Operações gerais da empresa"),
    ("Formação", "Formação e desenvolvimento"),
    ("Marketing", "Comunicação e marketing"),
    ("Recursos Humanos", "Gestão de pessoas"),
]

DEPARTMENT_ORDER: tuple[str, ...] = tuple(nome for nome, _ in DEPARTMENTS)


def department_rank(nome: str) -> int:
    """Posição oficial do departamento; nomes fora da lista ficam no fim."""
    try:
        return DEPARTMENT_ORDER.index(nome)
    except ValueError:
        return len(DEPARTMENT_ORDER)
