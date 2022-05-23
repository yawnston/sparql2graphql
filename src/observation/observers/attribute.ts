import { EndpointClient } from '../client';
import { EndpointObserver } from '../observer';
import {
    ObservationQuads,
    Observations,
    OntologyObservation,
    OntologyProperty,
} from '../ontology';
import { groupObservations } from '../utils';
import { Quad } from 'rdf-js';
import { ObservationConfig } from '../../api/config';
import { SPARQLEndpointDefinition } from '../endpoints';
import { Logger } from 'winston';

/**
 * Observer which makes observation about attributes,
 * i.e. properties whose range is literals.
 */
export class AttributeObserver implements EndpointObserver {
    triggers: OntologyObservation[] = [
        OntologyObservation.PropertyExistenceObservation,
    ];

    async observeEndpoint(
        triggerObservations: ObservationQuads[],
        endpoint: SPARQLEndpointDefinition,
        config: ObservationConfig,
        logger?: Logger,
    ): Promise<Observations> {
        const resultQuads: Quad[] = [];
        logger?.debug(
            `Observing ${triggerObservations.length} properties as attributes...`,
        );
        for (const observation of triggerObservations) {
            const classIri =
                observation[OntologyProperty.PropertyOf]!.object.value;
            const propertyIri =
                observation[OntologyProperty.PropertyIri]!.object.value;

            const client = new EndpointClient(endpoint, logger);
            const query = this.buildQuery(
                config.ontologyPrefixIri,
                classIri,
                propertyIri,
                config.propertySampleSize ?? 0,
            );
            const result = await client.runConstructQuery(query);
            resultQuads.push(...result.quads);
        }

        return groupObservations(resultQuads, config);
    }

    private buildQuery = (
        prefix: string,
        classIri: string,
        propertyIri: string,
        sampleSize: number,
    ) =>
        `PREFIX se: <${prefix}>
        CONSTRUCT {
        []
            a se:AttributeObservation ;
            se:describedAttribute <${propertyIri}> ;
            se:attributeSourceClass <${classIri}> ;
            se:targetLiteral ?targetLiteral .
        } WHERE {
            {
                SELECT ?targetLiteral
                WHERE {
                    GRAPH ?g {
                        ?instance
                            a <${classIri}> ;
                            <${propertyIri}> ?targetLiteral .
                        FILTER isLiteral(?targetLiteral) 
                    }
                }
                ${sampleSize > 0 ? `LIMIT ${sampleSize}` : ''}
            } 
        }`;
}
